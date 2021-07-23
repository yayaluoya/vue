/* @flow */

import config from 'core/config'
import { warn, cached } from 'core/util/index'
import { mark, measure } from 'core/util/perf'

import Vue from './runtime/index'
import { query } from './util/index'
import { compileToFunctions } from './compiler/index'
import { shouldDecodeNewlines, shouldDecodeNewlinesForHref } from './util/compat'

const idToTemplate = cached(id => {
  const el = query(id)
  return el && el.innerHTML
})

/** 重新对mount方法进行了包装，这次会包含把模板编译成render函数的编译器 */
const mount = Vue.prototype.$mount
Vue.prototype.$mount = function (
  el?: string | Element,
  hydrating?: boolean
): Component {
  el = el && query(el)

  /* istanbul ignore if */
  if (el === document.body || el === document.documentElement) {
    process.env.NODE_ENV !== 'production' && warn(
      `Do not mount Vue to <html> or <body> - mount to normal elements instead.`
    )
    return this
  }

  const options = this.$options
  // resolve template/el and convert to render function
  /** 
   * 如果不存在render函数的话就模板然后通过模板字符串编译出render方法。
   * 如果存在模板的话就判断模板是否是字符串，如果是就再判断是否是查询语句，如果是就获取查询的element元素的innerHTML内容，如果不是字符串的话就判断是否是个元素并获取他的innerHTML内容，既不是元素也不是字符串的话就直接报错并返回this
   * 如果不存在模板的话就获取html元素的OuterHTML字符串
   */
  if (!options.render) {
    let template = options.template
    if (template) {
      //如果是字符串的话
      if (typeof template === 'string') {
        //如果模板字符串首字符为#的话就认为是一个查询，并获取它对应元素的innerHTML
        if (template.charAt(0) === '#') {
          template = idToTemplate(template)
          /* istanbul ignore if */
          if (process.env.NODE_ENV !== 'production' && !template) {
            warn(
              `Template element not found or is empty: ${options.template}`,
              this
            )
          }
        }
      }
      //如果模板是个元素的话，注意这里还是用的innerHTML
      else if (template.nodeType) {
        template = template.innerHTML
      } else {
        //如果模板不是字符串也不是元素则抛出提示
        if (process.env.NODE_ENV !== 'production') {
          warn('invalid template option:' + template, this)
        }
        return this
      }
    } else if (el) {
      template = getOuterHTML(el)
    }
    //这里还判断了一次是否有模板，所以当el为''或者options.template='#'时下面的代码就不会执行了，render函数也不会被挂载，将在后续阶段被赋值为一个产生空虚拟节点的一个方法
    if (template) {
      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile')
      }

      /** !! 重点 */
      /** 生成render函数，通过编译器变异template生成render方法，这里就是编译的入口 */
      const { render, staticRenderFns } = compileToFunctions(template, {
        outputSourceRange: process.env.NODE_ENV !== 'production',
        shouldDecodeNewlines,
        shouldDecodeNewlinesForHref,
        delimiters: options.delimiters,
        comments: options.comments
      }, this)

      //对render函数进行挂载
      options.render = render
      options.staticRenderFns = staticRenderFns

      /* istanbul ignore if */
      if (process.env.NODE_ENV !== 'production' && config.performance && mark) {
        mark('compile end')
        measure(`vue ${this._name} compile`, 'compile', 'compile end')
      }
    }
  }
  return mount.call(this, el, hydrating)
}

/**
 * Get outerHTML of elements, taking care
 * of SVG elements in IE as well.
 */
function getOuterHTML(el: Element): string {
  if (el.outerHTML) {
    return el.outerHTML
  } else {
    const container = document.createElement('div')
    container.appendChild(el.cloneNode(true))
    return container.innerHTML
  }
}

Vue.compile = compileToFunctions

export default Vue
