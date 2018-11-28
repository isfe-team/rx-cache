/*!
 * 数据聚合层
 * [ref](https://github.com/xufei/blog/issues/38)
 * [ref2](https://zhuanlan.zhihu.com/p/28958042)
 */

import { Subject, BehaviorSubject, of, from, zip } from 'rxjs'
import { skipUntil, map, switchMap, filter, catchError, publishReplay, refCount } from 'rxjs/operators'
import includes from 'lodash/includes'
import { createSingleStream, Model } from './stream'

import {
  getUserInfo,
  getAuthorityList,
  searchSelectByType,
  getPreprocessors
} from '@/utils/api'
import { logger } from '@/utils/helpers'

import menu from '@/menu.json'

// const errorHandler = (error) => {
//   logger.error(error)
// }

/* 下面是为了测试 stream 的。以 userInfo$ 相关处理为例 */
const authS = window.authS = new Model({
  loadApi: getAuthorityList
})

window.authS$ = createSingleStream(authS)

// authS$ 可以和下面的 auth$ 直接替换，Oh yeah!

/* #0 基础信息 */

/* #0.1 用户信息 */
const userInfo$ = from(getUserInfo()).pipe(
  catchError((error) => {
    logger.error('userInfo$', error)
    return of({ })
  }),
  publishReplay(1),
  refCount()
)

/* #0.2 权限数据信息 */
const auth$ = from(
  process.env.NODE_ENV === 'development' ? menu.data : getAuthorityList()
).pipe(
  // catchError((error) => {
  //   logger.error('auth$', error)
  //   return of(menu.data)
  // }),
  // publishReplay(1),
  // refCount()
)

/* #1 整合基础信息 */
const root$ = zip(userInfo$, auth$)

root$.subscribe((data) => {
  logger.info('root$', data)
}, (error) => {
  logger.error('root$', error)
})

/* #2 生成树干，便于分发至分支中 */

/* 由于树干需要通知更新，所以需要是一个 Subject */

const trunk$ = (new Subject()).pipe(
  skipUntil(root$), // 在 root$ 产生数据之前，不 emit 任何值
  map((evt) => {
    logger.info('trunk$', evt)
    // 接受各种源的事件，为了统一，所以需要做一些转化
    return evt
  })
)

/* #3 生成分支 */

/* trunk 格式好的数据最后落实为 事件数组，具体的含义为需要更新的数据 */

/* 根据事件名，生成 Observable，其实是 Subject */

function generateBranch$ (source$, eventName) {
  return source$.pipe(
    filter((events) => {
      return includes(events, eventName)
    })
  )
}

/* #3.1 生成各个分支数据流 */

/* 防止以后要从后台获取、更新，都加一层 */

/* #3.1.1 接口类型信息 */
const interfaceTypesIn$ = generateBranch$(trunk$, 'interface_types')

/* #3.1.2 判断节点的判断条件信息 */
const judgeConditionsIn$ = generateBranch$(trunk$, 'judge_conditions')

/* #3.1.3 流程类型信息 */
const flowTypesIn$ = generateBranch$(trunk$, 'flow_types')

/* #3.1.4 节点类型信息 */
const nodeTypesIn$ = generateBranch$(trunk$, 'node_types')

/* #3.1.5 预处理类型信息 */
const preprocessorTypesIn$ = generateBranch$(trunk$, 'preprocessor_types')

/* #4 当接收到相应的事件通知后，后续必然也会有相应的处理逻辑 */

/* #4.1 接口类型 */
const interfaceTypes$ = interfaceTypesIn$.pipe(
  switchMap(() => from(searchSelectByType('interface_class'))),
  map((data) => {
    return data.data
  })
)

/* #4.2 判断节点的判断条件信息 */
const judgeConditions$ = judgeConditionsIn$.pipe(
  switchMap(() => from([ { code: 0, name: '等于' } ])),
  map((data) => {
    return data
  })
)

/* #4.3 流程类型信息 */
const flowTypes$ = flowTypesIn$.pipe(
  switchMap(() => from([ { code: 0, name: '主菜单类型' } ])),
  map((data) => {
    return data
  })
)

/* #4.4 节点类型信息 */
const nodeTypes$ = nodeTypesIn$.pipe(
  switchMap(() => from([ { code: 0, name: '用户交互节点' } ])),
  map((data) => {
    return data
  })
)

/* #4.5 预处理类型信息 */
const preprocessorTypes$ = preprocessorTypesIn$.pipe(
  switchMap(() => from(getPreprocessors())),
  map((data) => {
    return data.data
  })
)

/* #5 对外暴露接口 */

/* #5.1 基础数据 */

/* 注意，如果是多用户、多角色系统中，需要动态更新用户身份的话（比如管理员更改了某个用户的角色，该用户的权限需要动态获取了就），这时候，直接像下面这样 export userInfo$ 是有问题的，因为 fromPromise 是一次性的 */

export {
  userInfo$,
  auth$
}

/* 为了缓存数据，我们可以使用 BehaviorSubject */

export const interfaceTypes$$ = new BehaviorSubject()
interfaceTypes$.subscribe(interfaceTypes$$)

export const judgeConditions$$ = new BehaviorSubject()
judgeConditions$.subscribe(judgeConditions$$)

export const flowTypes$$ = new BehaviorSubject()
flowTypes$.subscribe(flowTypes$$)

export const nodeTypes$$ = new BehaviorSubject()
nodeTypes$.subscribe(nodeTypes$$)

export const preprocessorTypes$$ = new BehaviorSubject()
preprocessorTypes$.subscribe(preprocessorTypes$$)

;[ interfaceTypes$$, judgeConditions$$, flowTypes$$, nodeTypes$$, preprocessorTypes$$ ].forEach((x) => x.subscribe(
    (data) => {
      logger.info('$$', data)
    },
    (error) => {
      logger.error('$$', error)
    }
  ))

root$.subscribe(
  // ok 之后，next 一下
  (...args) => {
    console.log('root$ ok', args)
    trunk$.next([ 'interface_types', 'judge_conditions', 'flow_types', 'node_types', 'preprocessor_types' ])
  }
)

/* 为了简单点在 console 上发出事件 */
window.trunk$ = trunk$
