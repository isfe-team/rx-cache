/*!
 * async cache based on rx
 * @bqliu
 */

import { Subject, ReplaySubject, Observable, of, Subscription } from 'rxjs';
import { retry } from 'rxjs/operators';

type ObservableGenerator<T> = (...args: any[]) => Observable<T>;

export type CacheConfig<T> = {
  interceptors?: Array<Function>;
  // if 0, don't retry
  retryCount?: number;
  // if 0, don't replay
  replayCount?: number;
  observableGenerator: ObservableGenerator<T>;
}

const defaultCacheConfig: CacheConfig<void> = {
  interceptors: [],
  retryCount: 0,
  replayCount: 0,
  observableGenerator: () => of<void>()
}

export enum OperateType {
  FORCE_UPDATE = 0
} 

export class AsyncCache<T> {
  // define some interceptors
  interceptors: Array<Function>;
  retryCount: number;
  replayCount: number;
  currentCacheSubscription: Subscription | null = null;
  operateSubscription: Subscription;
  cache$$: Subject<any>;
  operate$$ = new Subject<OperateType>();
  observableGenerator: ObservableGenerator<T>;

  constructor(config: CacheConfig<T>) {
    this.interceptors = <Array<Function>>(config.interceptors || defaultCacheConfig.interceptors);
    this.retryCount = <number>(config.replayCount || defaultCacheConfig.retryCount);
    this.replayCount = <number>(config.replayCount || defaultCacheConfig.replayCount);
    this.observableGenerator = config.observableGenerator;
    this.cache$$ = this.retryCount === 0
                 ? new Subject<any>()
                 // for ReplaySubject, retryCount >= 1
                 : new ReplaySubject<any>(this.retryCount);
    
    this.operateSubscription = this.operate$$.subscribe(this.handleOperate.bind(this));

    this.cacheBoot();
  }

  // create another zone
  static create<R>(config: CacheConfig<R>) {
    return new AsyncCache<R>(config);
  }

  handleOperate(type: OperateType, ...args: any[]): void {
    if (type === OperateType.FORCE_UPDATE) {
      this.cacheBoot.apply(this, args);
    }
  }

  cacheBoot(...args: any[]): void {
    if (this.currentCacheSubscription) {
      // judge whether closed inner
      this.currentCacheSubscription.unsubscribe();
    }
    this.currentCacheSubscription = this.observableGenerator.apply(this, args).pipe(
      retry(this.retryCount)
    ).subscribe(this.cache$$);
  }

  dispose(): void {
    if (this.currentCacheSubscription) {
      this.currentCacheSubscription.unsubscribe();
    }
    this.operateSubscription.unsubscribe();
  }
}
