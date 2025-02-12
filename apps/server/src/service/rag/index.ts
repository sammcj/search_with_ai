import { TSearchEngine, IChatInputMessage, IStreamHandler, Provider, SearchFunc, TSearchMode, ISearchResponseResult, IChatResponse } from '../../interface';
import { searchWithBing, searchWithGoogle, searchWithSogou, searchWithSearXNG, searchWithChatGLM, searchWithTavily } from '../search';
import { DeepQueryPrompt, MoreQuestionsPrompt, RagQueryPrompt, ResearchSystemPrompt, TranslatePrompt } from './prompt';
import { ESearXNGCategory } from '../../libs/search/searxng';
import { getChatByProvider } from '../../libs/provider';
import { jinaUrlsReader } from '../../libs/jina';
import util from 'util';
import { IChatOptions } from '../../libs/provider/base/openai';
import { replaceVariable } from '../../libs/utils';

interface RagOptions {
  engine?: TSearchEngine
  stream?: boolean
  model?: string
  provider?: Provider
}

// const CACHE_NAME = 'search_with_ai';

export class Rag {
  private search: SearchFunc;
  private chat: (options: IChatOptions, onMessage?: IStreamHandler) => Promise<IChatResponse>;
  private model: string;
  // enable stream?
  private stream: boolean;
  // search engine
  private engine: TSearchEngine;

  constructor(params?: RagOptions) {
    const { engine = 'SEARXNG', stream = true, model, provider } = params || {};
    if (!model) throw new Error('[RAG] model is required');
    if (!provider) throw new Error('[RAG] provider is required');
    this.chat = getChatByProvider(provider);

    this.model = model;
    this.stream = stream;
    this.engine = engine;

    switch (engine) {
      case 'GOOGLE':
        this.search = searchWithGoogle;
        break;
      case 'BING':
        this.search = searchWithBing;
        break;
      case 'SOGOU':
        this.search = searchWithSogou;
        break;
      case 'SEARXNG':
        this.search = searchWithSearXNG;
        break;
      case 'CHATGLM':
        this.search = searchWithChatGLM;
        break;
      case 'TAVILY':
        this.search = searchWithTavily;
        break;
      default:
        this.search = searchWithSearXNG;
    }
  }

  public async query(query: string, categories = [ESearXNGCategory.GENERAL], mode: TSearchMode = 'simple', language = 'all', onMessage?: (...args: any[]) => void) {
    let searchQuery = query;
    // rewrite query for [SCIENCE]
    if (categories.includes(ESearXNGCategory.SCIENCE) && this.engine === 'SEARXNG') {
      const rewrite = await this.translate(query);
      if (rewrite) searchQuery = rewrite;
    }

    // Parameters supported by searxng: categories.
    const contexts = await this.search(searchQuery, categories, language);
    const REFERENCE_COUNT = process.env.REFERENCE_COUNT || 8;
    let limitContexts = contexts.slice(0, +REFERENCE_COUNT);

    if (mode === 'research') {
      const fullContexts = await this.getFullSearchResult(limitContexts);
      limitContexts = limitContexts.map((item, index) => ({
        ...item,
        content: fullContexts[index].content || ''
      }));
    }

    let images: Record<string, any>[] = [];

    // searxng images search
    if (this.engine === 'SEARXNG') {
      const res = await this.search(query, [ESearXNGCategory.IMAGES], language);
      const engines = process.env.SEARXNG_IMAGES_ENGINES ? process.env.SEARXNG_IMAGES_ENGINES.split(',') : [];

      images = res.filter(item => {
        if (!item.thumbnail) return false;
        if (engines.length > 0)
          return engines.some(engine => item.engine?.includes(engine));
        return item.engine?.includes('bing') || item.engine?.includes('google');
      });
    }

    if (!this.stream) {
      const relatedPromise = this.getRelatedQuestions(query, limitContexts);
      const answerPromise = this.getAiAnswer(query, contexts);
      const [related, answer] = await Promise.all([relatedPromise, answerPromise]);
      return {
        related,
        images,
        contexts: limitContexts,
        ...answer
      };
    }

    for (const image of images) {
      onMessage?.(JSON.stringify({ image }));
    }

    for (const context of limitContexts) {
      onMessage?.(JSON.stringify({ context }));
    }

    await this.getAiAnswer(query, limitContexts, mode, (msg) => {
      onMessage?.(JSON.stringify(msg));
    });

    await this.getRelatedQuestions(query, limitContexts, (msg) => {
      onMessage?.(JSON.stringify({ related: msg?.content }));
    });

    onMessage?.(null, true);
  }

  private async getFullSearchResult(results: ISearchResponseResult[]) {
    const urls = results.map(item => item.url);
    const fullContexts = await jinaUrlsReader({ urls });
    return fullContexts;
  }

  // Gets related questions based on the query and context.
  private async getRelatedQuestions(query: string, contexts: any[], onMessage?: IStreamHandler) {
    try {
      const { messages } = this.paramsFormatter(query, undefined, contexts, 'related');
      const { model } = this;
      if (typeof onMessage === 'function') {
        await this.chat({ messages, model }, onMessage);
        return;
      }
      const res = await this.chat({ messages, model });
      return res.content;
    } catch (err) {
      console.error('[LLM Error]:', err);
      return '';
    }
  }

  private async getAiAnswer(query: string, contexts: any[], mode: TSearchMode = 'simple', onMessage?: IStreamHandler) {
    const { model, stream } = this;
    try {
      const { messages } = this.paramsFormatter(query, mode, contexts, 'answer');
      if (!stream) {
        const res = await this.chat({ messages, model });
        return res;
      }
      await this.chat({ messages, model }, (msg) => {
        onMessage?.(msg);
      });
    } catch (err: any) {
      console.error('[LLM Error]:', err);
      const msg = {
        content: `[Oops~ Some errors seem to have occurred]: ${err?.message || 'Please check the console'}`,
      };
      if (!stream) return msg;
      else onMessage?.(msg, true);
    }
  }

  // translate
  private async translate(text: string, targetLang = 'English'): Promise<string> {
    try {
      const content = util.format(TranslatePrompt, targetLang, text);
      const messages: IChatInputMessage[] = [
        {
          role: 'user',
          content
        }
      ];
      // console.log(content);
      const { model, stream } = this;
      let translated = '';
      if (!stream) {
        const res = await this.chat({ messages, model });
        translated = res.content;
      } else {
        await this.chat({ messages, model }, (msg) => {
          if (msg) translated += msg.content;
        });
      }
      return translated;
    } catch (err) {
      console.log('[RAG Translate error]', err);
      return text;
    }
  }

  private paramsFormatter(query: string, mode: TSearchMode = 'simple', contexts: any[], type: 'answer' | 'related') {
    const context = contexts.map(
      (item, index) => `[[citation:${index + 1}]] ${item.content || item.snippet}`
    ).join('\n\n');

    let prompt = MoreQuestionsPrompt;

    const date = new Date().toISOString();

    // deep answer
    if (mode === 'deep' && type === 'answer') {
      prompt = replaceVariable(DeepQueryPrompt, { date });
    }

    if (type === 'answer') {
      if (mode === 'deep') {
        prompt = replaceVariable(DeepQueryPrompt, { date });
      }
      if (mode === 'simple' || mode === 'research') {
        prompt = replaceVariable(RagQueryPrompt, { date });
      }
    }

    const system = util.format(prompt, context);
    const messages: IChatInputMessage[] = [
      {
        role: 'user',
        content: `${system} ${query}`
      }
    ];

    if (mode === 'research' && type === 'answer') {
      messages.unshift({
        role: 'system',
        content: ResearchSystemPrompt
      });
    }

    return {
      messages
    };
  }
}
