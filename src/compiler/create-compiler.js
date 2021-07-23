/* @flow */

import { extend } from 'shared/util'
import { detectErrors } from './error-detector'
import { createCompileToFunctionFn } from './to-function'
/**
 * 
 * @param {*} baseCompile 能生成render的基础编译方法
 */
export function createCompilerCreator(baseCompile: Function): Function {
  /** 这个方法的目的有点绕，传入的是一个基础选项 */
  return function createCompiler(baseOptions: CompilerOptions) {
    /** 把baseCompile包装成一个成熟的编译方法 */
    function compile(
      template: string,
      options?: CompilerOptions
    ): CompiledResult {
      //最终选项
      const finalOptions = Object.create(baseOptions)
      const errors = []
      const tips = []

      let warn = (msg, range, tip) => {
        (tip ? tips : errors).push(msg)
      }

      /** 添加一些选项 */
      if (options) {
        if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
          // $flow-disable-line
          const leadingSpaceLength = template.match(/^\s*/)[0].length

          warn = (msg, range, tip) => {
            const data: WarningMessage = { msg }
            if (range) {
              if (range.start != null) {
                data.start = range.start + leadingSpaceLength
              }
              if (range.end != null) {
                data.end = range.end + leadingSpaceLength
              }
            }
            (tip ? tips : errors).push(data)
          }
        }
        // merge custom modules
        if (options.modules) {
          finalOptions.modules =
            (baseOptions.modules || []).concat(options.modules)
        }
        // merge custom directives
        if (options.directives) {
          finalOptions.directives = extend(
            Object.create(baseOptions.directives || null),
            options.directives
          )
        }
        // copy other options
        for (const key in options) {
          if (key !== 'modules' && key !== 'directives') {
            finalOptions[key] = options[key]
          }
        }
      }

      finalOptions.warn = warn

      /**
       * 重点，调用基础编译方法，并传入整理好的选项
       * trim方法用于去除字符串首尾空格
       */
      const compiled = baseCompile(template.trim(), finalOptions)
      if (process.env.NODE_ENV !== 'production') {
        //检测错误
        detectErrors(compiled.ast, warn)
      }
      //把一些附加内容添加上
      compiled.errors = errors
      compiled.tips = tips
      //
      return compiled
    }

    return {
      compile,
      compileToFunctions: createCompileToFunctionFn(compile)
    }
  }
}
