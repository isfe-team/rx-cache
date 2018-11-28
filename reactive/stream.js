/*!
 * 单一数据流控制，是为了测试想法的试验品。
 *
 * 我们为了获取某个数据，最好的情况是 数据已经准备好，但是并不能总是如愿。
 * 因为牵涉到了异步。
 *
 * 有时候，第一次获取数据失败了，如果是一些全局使用的数据，比如类型列表。
 * 如果获取失败，智能一点的话可以考虑 retry n 次。
 * 但是总可能会是失败的，比如短时间内突然断网。
 *
 * 如果失败了，可以给出一个友好的提示，同时下次 load，我们需要去重新 load，因为之前已经 error 了。
 *
 * 如果不考虑时效，我们可以一直缓存。
 * 如果考虑失效，我们可以触发强制更新。
 *
 * 同样的，由于异步，导致会出现以下几种状态（可能需要补充）：
 *   1、未获取过，无缓存
 *   2、在获取中
 *   3、获取过，但是出错了（毕竟异步）
 *   4、获取过，同时有缓存（数据是正确的）
 *   5、（不管是获取过还是有缓存或其它状态）需要更新（毕竟可能会有动态变更，比如角色、权限突然变化）
 *
 * 为了更优雅的写业务代码，所以我们肯定不能在业务代码中直接处理这些情况，所以考虑在数据流这块做优化。
 *
 * @NOTICE loadApi 为 Promise-based
 * @NOTIECE 数据的获取可能存在一些逻辑上的顺序，比如 auth$ -> service$，这个也需要解决，但是貌似很难解决，先不考虑。不过简单的话，可以考虑直接将多个异步流程用 Promise 包装成一个。
 */

import { Observable } from 'rxjs'
import noop from 'lodash/noop'

/*
 * 为了表示各种状态。
 */

const dataState = {
  NO_CACHE: 1,
  FETCHING: 2,
  ERROR: 3,
  CACHED: 4,
  NEED_UPDATE: 5
}

/* 以该 Model 来创建，为了防止一些变更，类似于 Java，提供 getXX 和 setXX api */

export class Model {
  constructor ({
    initialState = dataState.NO_CACHE,
    payload = null,
    loadApi = null,
    queryParam = null,
    queryParamStringifier = JSON.stringify
  } = { }) {
    this._data = payload
    this._loadApi = loadApi
    this._state = initialState
    this._queryParam = queryParam
    this._queryParamStringifier = queryParamStringifier
    this._setters = [ ]
  }

  getState () { return this._state }

  getData () { return this._data }

  getLoadApi () { return this._loadApi }

  setQueryParamStringifier (stringifier) {
    this._queryParamStringifier = stringifier
  }

  getQueryParam () { return this._queryParam }

  setQueryParam (param) { this._queryParam = param }

  resetQueryParam () { this.setQueryParam(null) }

  getStringifiedQueryParams () {
    return this._queryParamStringifier(this.getQueryParam)
  }

  // setters 和 listener 严禁修改内部 state 和 data
  setState ({ state, payload = null } = { }, listener = noop) {
    const prevState = this.getState()
    const prevPayload = this.getData()
    this._state = state
    this._data = payload
    const prevStatus = { state: prevState, payload: prevPayload }
    const newStatus = { state, payload }
    ;
    [{ listener }, ...this._setters].forEach((setter) => {
      setter.listener.call(this, prevStatus, newStatus)
    })
    // remove once listener
    this._setters = this._setters.filter((setter) => !setter.once)
  }

  addStateSetterListener (listener = noop, once = false) {
    this._setters.push({ listener, once })
  }

  removeStateSetterListener (listener) {
    // if no specific listener, remove all
    if (!listener) {
      this._setters = [ ]
      return
    }
    const index = this._setters.indexOf(listener)
    if (index !== -1) {
      this._setters.splice(index, 1)
    }
  }
}

const fetchDataRel = (observer, model) => {
  // reset state
  model.setState({ state: dataState.FETCHING })

  // when excuted, ctx => model
  function okHandler () {
    observer.next(this.getData())
    observer.complete()
  }
  function errorHandler () {
    observer.error(this.getData())
  }

  const api = model.getLoadApi()
  if (!api) {
    model.setState(
      { state: dataState.CACHED, payload: model.getData() },
      okHandler
    )
  }

  api(model.getQueryParam()).then((data) => {
    model.setState(
      { state: dataState.CACHED, payload: data },
      okHandler
    )
  }).catch((error) => {
    model.setState(
      { state: dataState.ERROR, payload: error },
      errorHandler
    )
  })
}

/* 单次监听 model state 的变化 */
const observeModelStateSetterOnce = (observer, model) => {
  const listener = function (prevStatus, newStatus) {
    if (newStatus.state === dataState.ERROR) {
      observer.error(newStatus.payload)
      return
    }
    observer.next(newStatus.payload)
    observer.complete()
  }
  model.addStateSetterListener(listener, true)
  return function removeListener () {
    model.removeStateSetterListener(listener)
  }
}

export const createSingleStream = (model) => {
  return Observable.create(function excutor (observer) {
    switch (model.getState()) {
      case dataState.CACHED:
        observer.next(model.getData())
        observer.complete()
        break
      // fetching 优先于 need_update
      // 所以放在上面
      case dataState.FETCHING:
        observeModelStateSetterOnce(observer, model)
        break
      // 以下几种情况都直接 fetch
      case dataState.NO_CACHE:
      case dataState.ERROR:
      case dataState.NEED_UPDATE:
        fetchDataRel(observer, model)
        break
      default:
        throw new Error('No this state:', model.getState())
    }
  })
}
