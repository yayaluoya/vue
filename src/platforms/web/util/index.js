/* @flow */

import { warn } from 'core/util/index'

export * from './attrs'
export * from './class'
export * from './element'

/**
 * Query an element selector if it's not an element already.
 * 获取元素，如果是字符串就查询，查不到就创建一个div元素，如果不是字符串就直接返回
 */
export function query(el: string | Element): Element {
  if (typeof el === 'string') {
    //直接查询这个元素，返回匹配的第一个元素
    const selected = document.querySelector(el)
    if (!selected) {
      process.env.NODE_ENV !== 'production' && warn(
        'Cannot find element: ' + el
      )
      //创建一个元素
      return document.createElement('div')
    }
    return selected
  } else {
    return el
  }
}
