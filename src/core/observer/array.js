/*
 * not type checking this file because flow doesn't play well with
 * dynamically accessing methods on Array prototype
 */

import { def } from '../util/index'

const arrayProto = Array.prototype
export const arrayMethods = Object.create(arrayProto)

const methodsToPatch = [
  'push',
  'pop',
  'shift',
  'unshift',
  'splice',
  'sort',
  'reverse'
]

/**
 * Intercept mutating methods and emit events
 */
methodsToPatch.forEach(function (method) {
  // cache original method
  const original = arrayProto[method]
  def(arrayMethods, method, function mutator(...args) {
    const result = original.apply(this, args)
    const ob = this.__ob__
    //获取调用这些方法时传递进来的新对象，是个对象数组
    let inserted
    switch (method) {
      case 'push':
      case 'unshift':
        //获取所有参数列表
        inserted = args
        break
      case 'splice':
        //获取改方法后面的新添加内容参数列表
        inserted = args.slice(2)
        break
    }
    //为这个新对象设置响应式
    if (inserted) ob.observeArray(inserted)
    // notify change 更新
    ob.dep.notify()
    return result
  })
})
