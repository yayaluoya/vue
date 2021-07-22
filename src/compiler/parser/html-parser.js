/**
 * Not type-checking this file because it's mostly vendor code.
 */

/*!
 * HTML Parser By John Resig (ejohn.org)
 * Modified by Juriy "kangax" Zaytsev
 * Original code by Erik Arvidsson (MPL-1.1 OR Apache-2.0 OR GPL-2.0-or-later)
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 */

import { makeMap, no } from 'shared/util'
import { isNonPhrasingTag } from 'web/compiler/util'
import { unicodeRegExp } from 'core/util/lang'

// Regular Expressions for parsing tags and attributes//解析标签和属性的正则表达式
/** 静态属性（包括v-bind，@，:，#这些保留符）就是它和下面的动态属性匹配的正则匹配的结果是当成同等类型的，也就是说他们的分组是一样的 */
const attribute = /^\s*([^\s"'<>\/=]+)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/
/** 动态参数属性，比如所指令v-.*|:|@|# 然后后面根[某个变量或者字符串，表示这个是动态的] */
const dynamicArgAttribute = /^\s*((?:v-[\w-]+:|@|:|#)\[[^=]+?\][^\s"'<>\/=]*)(?:\s*(=)\s*(?:"([^"]*)"+|'([^']*)'+|([^\s"'=<>`]+)))?/ //注意(?:v-[\w-]+:|@|:|#)是取消分组捕获的，目的是和上一个正则保持同样的分组
/** 标签命，首字符不能是连字符- */
const ncname = `[a-zA-Z_][\\-\\.0-9_a-zA-Z${unicodeRegExp.source}]*`//unicodeRegExp.source是一个可以匹配特殊字符的正则的源
const qnameCapture = `((?:${ncname}\\:)?${ncname})`
/** 开始标签打开 */
const startTagOpen = new RegExp(`^<${qnameCapture}`)
/** > 符号，注意是^\s*开头的，意思就是只是匹配 >符号 */
const startTagClose = /^\s*(\/?)>/ //注意这里的(\/?)是用来判断是否是自闭合标签的，也就是说是用来判断是否是一元标签的
/** 结束标签 */
const endTag = new RegExp(`^<\\/${qnameCapture}[^>]*>`)
/** 文档类型 */
const doctype = /^<!DOCTYPE [^>]+>/i
// #7298: escape - to avoid being passed as HTML comment when inlined in page
/** 注释 */
const comment = /^<!\--/
/** 条件注释 */
const conditionalComment = /^<!\[/

// Special Elements (can contain anything)
/** 特殊元素(可以包含任何内容) */
export const isPlainTextElement = makeMap('script,style,textarea', true)
const reCache = {}

const decodingMap = {
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&amp;': '&',
  '&#10;': '\n',
  '&#9;': '\t',
  '&#39;': "'"
}
const encodedAttr = /&(?:lt|gt|quot|amp|#39);/g
const encodedAttrWithNewLines = /&(?:lt|gt|quot|amp|#39|#10|#9);/g

// #5992
const isIgnoreNewlineTag = makeMap('pre,textarea', true)
const shouldIgnoreFirstNewline = (tag, html) => tag && isIgnoreNewlineTag(tag) && html[0] === '\n'

/** 对属性字符串解码，主要解码一些特殊字符 */
function decodeAttr(value, shouldDecodeNewlines) {
  //获取匹配特殊字符的正则
  const re = shouldDecodeNewlines ? encodedAttrWithNewLines : encodedAttr
  //替换特殊字符
  return value.replace(re, match => decodingMap[match])
}

/**
 * 一步一步的消耗掉整个字符串，然后通过选项里面的工具函数把结果传回去，相当于这个函数就是个外包函数
 * 解析出html字符串的表情和属性列表
 * 想要理解这个方法就必须深刻理解闭包，这样才能理解到它的外包性质
 * 注意这个方法只是解析，并不做任何处理
 * @param {*} html 源html字符串
 * @param {*} options 选项
 */
export function parseHTML(html, options) {
  const stack = []
  const expectHTML = options.expectHTML
  const isUnaryTag = options.isUnaryTag || no
  const canBeLeftOpenTag = options.canBeLeftOpenTag || no
  let index = 0
  let last, lastTag
  while (html) {
    last = html
    // Make sure we're not in a plaintext content element like script/style
    //确保我们不在像脚本/样式这样的明文内容元素中
    if (!lastTag || !isPlainTextElement(lastTag)) {
      let textEnd = html.indexOf('<')
      //说明首字符是<
      if (textEnd === 0) {
        // Comment: 
        if (comment.test(html)) {
          const commentEnd = html.indexOf('-->')

          if (commentEnd >= 0) {
            if (options.shouldKeepComment) {
              options.comment(html.substring(4, commentEnd), index, index + commentEnd + 3)
            }
            advance(commentEnd + 3)
            continue
          }
        }

        // http://en.wikipedia.org/wiki/Conditional_comment#Downlevel-revealed_conditional_comment
        if (conditionalComment.test(html)) {
          const conditionalEnd = html.indexOf(']>')

          if (conditionalEnd >= 0) {
            advance(conditionalEnd + 2)
            continue
          }
        }

        // Doctype:
        const doctypeMatch = html.match(doctype)
        if (doctypeMatch) {
          advance(doctypeMatch[0].length)
          continue
        }

        //真正开始处理元素，上面的两个就相当于不要了

        // End tag:
        const endTagMatch = html.match(endTag)
        if (endTagMatch) {
          const curIndex = index
          advance(endTagMatch[0].length)
          //处理借宿标签
          parseEndTag(endTagMatch[1], curIndex, index)
          continue
        }

        // Start tag: 匹配开始标签，主要获取标签名字，整理标签属性
        const startTagMatch = parseStartTag()//获取匹配对象
        if (startTagMatch) {
          //处理匹配对象
          handleStartTag(startTagMatch)
          //判断并忽略第一个换行符
          if (shouldIgnoreFirstNewline(startTagMatch.tagName, html)) {
            //剪切掉第一个换行符
            advance(1)
          }
          // console.log(startTagMatch);
          continue
        }
      }

      let text, rest, next
      //如果第一个字符不是<符号的话
      if (textEnd >= 0) {
        //把<之后的内容剪切出来
        rest = html.slice(textEnd);
        //如果<符号开头的字符串不符合html标签定义，就找到下一个<符号并以它作为字符串开头，这里做的工作就相当于是规范字符串
        while (
          !endTag.test(rest) &&
          !startTagOpen.test(rest) &&
          !comment.test(rest) &&
          !conditionalComment.test(rest)
        ) {
          // < in plain text, be forgiving and treat it as text
          next = rest.indexOf('<', 1)
          if (next < 0) break
          textEnd += next
          rest = html.slice(textEnd)
        }
        //获取<标签之前的内容
        text = html.substring(0, textEnd)
      }

      if (textEnd < 0) {
        text = html
      }

      if (text) {
        advance(text.length)
      }

      //判断选项中是否有处理字符串元素的方法，如果有就执行
      if (options.chars && text) {
        options.chars(text, index - text.length, index)
      }
    }
    //当当前有记录的lastTag且这个lastTag是个特殊标签时执行
    else {
      let endTagLength = 0
      const stackedTag = lastTag.toLowerCase()
      const reStackedTag = reCache[stackedTag] || (reCache[stackedTag] = new RegExp('([\\s\\S]*?)(</' + stackedTag + '[^>]*>)', 'i'))
      //匹配这个完整的标签，并且根据捕获分组内容剪切掉这个标签
      const rest = html.replace(reStackedTag, function (all, text, endTag) {
        endTagLength = endTag.length
        if (!isPlainTextElement(stackedTag) && stackedTag !== 'noscript') {
          //把一些标签去掉只保留内容
          text = text
            .replace(/<!\--([\s\S]*?)-->/g, '$1') // #7298
            .replace(/<!\[CDATA\[([\s\S]*?)]]>/g, '$1')
        }
        //判断并忽略掉第一个换行符
        if (shouldIgnoreFirstNewline(stackedTag, text)) {
          text = text.slice(1)
        }
        //当成字符串处理
        if (options.chars) {
          options.chars(text)
        }
        return ''
      })
      index += html.length - rest.length
      html = rest
      parseEndTag(stackedTag, index - endTagLength, index)
    }

    //如果html直接是last就说明html没有被处理过所以就当成字符串处理了
    if (html === last) {
      options.chars && options.chars(html)
      if (process.env.NODE_ENV !== 'production' && !stack.length && options.warn) {
        options.warn(`Mal-formatted tag at end of template: "${html}"`, { start: index + html.length })
      }
      break
    }
  }

  // Clean up any remaining tags
  //清理所以剩下的标签
  parseEndTag()

  /** 剪切掉索引以前的内容，并记录当前首字符的原索引index */
  function advance(n) {
    index += n
    //截取字符串，从n开始
    html = html.substring(n)
  }

  /** 解析开始标签 */
  function parseStartTag() {
    //匹配的是一个 <tagname-tagname 格式的
    const start = html.match(startTagOpen)
    //判断是否存在，不存在直接返回undefined
    if (start) {
      //定义一个match对象，也就是匹配对象
      const match = {
        tagName: start[1],//标签名
        attrs: [],//属性列表
        start: index//开始索引
      }
      //剪切掉开始匹配的开始标签，注意是从匹配的结果0的长度开始，这个结果是正则匹配的全部结果，1是第一个分组的结果
      advance(start[0].length)
      //
      let end, attr//end就是   >的结果
      //这个时候标签前面的包含标签名的字符串已经剪切掉了，dynamicArgAttribute匹配动态属性，attribute匹配静态属性，所以attr就等于属性匹配结果了，注意包括分组哦
      while (!(end = html.match(startTagClose)) && (attr = html.match(dynamicArgAttribute) || html.match(attribute))) {
        //这个attr就是匹配的属性对象
        attr.start = index
        //剪切掉这个属性的整个表达字符串
        advance(attr[0].length)
        attr.end = index
        //添加到匹配对象里面，注意这个attr是包含分组的
        match.attrs.push(attr)
        // console.log(attr);
      }
      //匹配到>符号
      if (end) {
        // console.log(end);
        match.unarySlash = end[1]//这里是判断是否在>符号前匹配到了/，如果是则这个标签是个自闭合标签
        //剪切掉结尾的闭合标签，到这里这个标签的开头部分全被删了，只剩下内容和结尾了
        advance(end[0].length)
        match.end = index
        //返回匹配结果
        return match
      }
    }
  }

  /**
   * 处理开始标签
   * @param {*} match 开始标签匹配结果
   */
  function handleStartTag(match) {
    const tagName = match.tagName//标签名
    const unarySlash = match.unarySlash//这个值如果存在则是个自闭合标签

    //期望html
    if (expectHTML) {
      if (lastTag === 'p' && isNonPhrasingTag(tagName)) {
        parseEndTag(lastTag)
      }
      if (canBeLeftOpenTag(tagName) && lastTag === tagName) {
        parseEndTag(tagName)
      }
    }

    //是否是一元标签
    const unary = isUnaryTag(tagName) || !!unarySlash//isUnaryTag方法是匹配一些html自带的一元标签，找不到才去判断是否是其它的一元标签

    //处理属性
    const l = match.attrs.length
    const attrs = new Array(l)//提取属性到这个列表中
    for (let i = 0; i < l; i++) {
      const args = match.attrs[i]
      //获取值，这个个分组中的一个
      const value = args[3] || args[4] || args[5] || ''
      //
      const shouldDecodeNewlines = tagName === 'a' && args[1] === 'href'
        ? options.shouldDecodeNewlinesForHref
        : options.shouldDecodeNewlines
      //根据属性匹配结果，重新处理属性结果
      // console.log(args[1], value, shouldDecodeNewlines);
      attrs[i] = {
        name: args[1],//属性名字
        value: decodeAttr(value, shouldDecodeNewlines)//对属性解码，就是把特殊字符转换回来，shouldDecodeNewlines值得作用是用来判断特殊字符都是些什么
      }
      if (process.env.NODE_ENV !== 'production' && options.outputSourceRange) {
        attrs[i].start = args.start + args[0].match(/^\s*/).length
        attrs[i].end = args.end
      }
    }

    if (!unary) {
      //添加到队列当中，注意这里是添加的一个新创建的对象
      stack.push({ tag: tagName, lowerCasedTag: tagName.toLowerCase(), attrs: attrs, start: match.start, end: match.end })
      //记录当前的标签名字
      lastTag = tagName
    }

    //判断选项中是否有处理startTab的方法
    if (options.start) {
      //调用选项中的start方法处理标签，这里把是否是一元标签的状态传了过去，表示用外部传递进来的方法来处理
      options.start(tagName, attrs, unary, match.start, match.end)
    }
  }

  /**
   * 解析结束标签
   * @param {*} tagName 标签名字
   * @param {*} start 开始索引
   * @param {*} end 结束索引
   */
  function parseEndTag(tagName, start, end) {
    let pos, lowerCasedTagName
    if (start == null) start = index
    if (end == null) end = index

    // Find the closest opened tag of the same type
    //找到最近相同类型的打开标签
    if (tagName) {
      lowerCasedTagName = tagName.toLowerCase()
      for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === lowerCasedTagName) {
          break
        }
      }
    } else {
      // If no tag name is provided, clean shop
      pos = 0
    }

    if (pos >= 0) {
      // Close all the open elements, up the stack
      //关闭堆栈中所有打开的标签，所以这里要从堆栈结尾开始遍历，任何出现在与结束标签名字相同的标签后面的标签全部都关闭了，因为在树形结构中它们已经没有存在的意义了
      for (let i = stack.length - 1; i >= pos; i--) {
        if (process.env.NODE_ENV !== 'production' &&
          (i > pos || !tagName) &&
          options.warn
        ) {
          options.warn(
            `tag <${stack[i].tag}> has no matching end tag.`,
            { start: stack[i].start, end: stack[i].end }
          )
        }
        //判断选项中是否有传进来的end方法，如果有就执行
        if (options.end) {
          options.end(stack[i].tag, start, end)
        }
      }

      // Remove the open elements from the stack
      //删除掉已经关闭了的标签
      stack.length = pos
      //重置记录标签为当前堆栈中的最后一个也就是最新添加进去的那个标签
      lastTag = pos && stack[pos - 1].tag
    }
    //特殊标签做特殊处理s
    else if (lowerCasedTagName === 'br') {
      if (options.start) {
        options.start(tagName, [], true, start, end)
      }
    } else if (lowerCasedTagName === 'p') {
      if (options.start) {
        options.start(tagName, [], false, start, end)
      }
      if (options.end) {
        options.end(tagName, start, end)
      }
    }
  }
}
