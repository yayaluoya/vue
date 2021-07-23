/* @flow */

import { parse } from './parser/index'
import { optimize } from './optimizer'
import { generate } from './codegen/index'
import { createCompilerCreator } from './create-compiler'

// `createCompilerCreator` allows creating compilers that use alternative
// parser/optimizer/codegen, e.g the SSR optimizing compiler.
// Here we just export a default compiler using the default parts.
//它的参数就是核心编译器
/**
 * createCompilerCreator方法的目的是能生成
 * {
 *  compile
    compileToFunctions //这个方法能生成 {redner}，所以这个东西就是编译需要的东西
 * }
  它传进去的参数就能生成 {redner}，所以这个方法就是把传进去的这个参数包装一下，并返回改返回的东西
 */
export const createCompiler = createCompilerCreator(
  function baseCompile(
    template: string,
    options: CompilerOptions
  ): CompiledResult {
    //解析ast，就相当于是一个描述template行为的对象
    const ast = parse(template.trim(), options)
    //优化ast
    if (options.optimize !== false) {
      optimize(ast, options)
    }
    //生成代码，将ast转成可执行render函数的字符串形式
    const code = generate(ast, options)
    return {
      ast,
      render: code.render,
      staticRenderFns: code.staticRenderFns
    }
  }
)
