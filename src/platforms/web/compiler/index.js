/* @flow */

import { baseOptions } from './options'
import { createCompiler } from 'compiler/index'
/** 传入基础选项 */
const { compile, compileToFunctions } = createCompiler(baseOptions)

export { compile, compileToFunctions }
