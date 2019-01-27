/* placeholder */
import { Subscription, interval, from, Subject } from 'rxjs'
import { mergeMap } from 'rxjs/operators'

function asyncTask (x: string) {
  return from(new Promise(function (resolve) {
    setTimeout(() => {
      resolve(x);
    }, 2000);
  }))
};

class Base {
  rootSubscription: Subscription;

  constructor () {
    this.rootSubscription = new Subscription()
  }

  addToRootSubscription (sub: Subscription) {
    this.rootSubscription.add(sub)
  }

  removeFromRootSubscription (sub: Subscription) {
    this.rootSubscription.remove(sub)
  }

  beforeDestroy () {
    this.rootSubscription.unsubscribe()
  }
}

class Component extends Base {
  subscription: Subscription

  constructor () {
    super()

    const notify$$ = new Subject<number>();

    this.subscription = notify$$.pipe(mergeMap((x) => {
      if (x % 2 === 0) {
        return asyncTask('odd')
      }
      return asyncTask('even')
    })).subscribe((...args) => {
      console.log('x', args);
    });
    
    this.addToRootSubscription(this.subscription)
    interval(500).subscribe((x) => notify$$.next(x))
  }

  beforeDestroy () {
    console.log(1)
    super.beforeDestroy()
  }
}

// @ts-ignore
window.x = new Component()
