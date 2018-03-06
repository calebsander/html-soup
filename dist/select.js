"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const parse_1 = require("./parse");
const regexEscape = (str) => str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
const WHITESPACE = /^\s$/, HTML_COMMENT_START = '<!--', HTML_COMMENT_END = '-->';
function isWhiteSpace(str) {
    while (str) {
        if (WHITESPACE.test(str[0]))
            str = str.trimLeft();
        else if (str.startsWith(HTML_COMMENT_START)) {
            const commentEndIndex = str.indexOf(HTML_COMMENT_END, HTML_COMMENT_START.length);
            if (commentEndIndex > -1)
                str = str.substring(commentEndIndex + HTML_COMMENT_END.length);
            else
                return false;
        }
        else
            return false;
    }
    return true;
}
const SEPARATOR_CHARS = new Set([',', ' ', '>', '+', '~']);
const isSeparator = (c) => SEPARATOR_CHARS.has(c);
class SelectorReadingState {
}
const TAG = new SelectorReadingState, CLASS = new SelectorReadingState, ID = new SelectorReadingState, ATTRIBUTES = new SelectorReadingState, PSEUDOS = new SelectorReadingState;
const EXISTING = true, EQUALING = '=', CONTAINING_WHOLE_WORD = '~=', STARTING_WHOLE_WORD = '|=', STARTING = '^=', ENDING = '$=', CONTAINING = '*=';
const ATTRIBUTE_TYPES = [CONTAINING_WHOLE_WORD, STARTING_WHOLE_WORD, STARTING, ENDING, CONTAINING, EQUALING /*must be matched last*/];
class AttributeMatch {
    constructor(attribute, matchType, value) {
        this.attribute = attribute;
        this.matchType = matchType;
        this.value = value;
        if (matchType !== EXISTING && value === undefined)
            throw new Error('Value not specified');
    }
}
const stripQuotes = (str) => (str.length > 1 && str[0] === '"' && str.substr(-1) === '"') ? str.slice(1, -1) : str;
class Selector {
}
class SingleSelector extends Selector {
    constructor(selectorString) {
        super();
        this.classes = [];
        this.attributes = [];
        this.pseudos = [];
        const saveSegment = () => {
            switch (state) {
                case TAG:
                    this.tagName = (!name || name === '*') ? '*' : name;
                    break;
                case CLASS:
                    this.classes.push(name);
                    break;
                case ID:
                    this.id = name;
                    break;
                case ATTRIBUTES:
                    let noAttrMatch = true;
                    for (const attributeType of ATTRIBUTE_TYPES) {
                        let index = name.indexOf(attributeType);
                        if (index > -1) {
                            this.attributes.push(new AttributeMatch(name.substring(0, index), attributeType, stripQuotes(name.substring(index + attributeType.length))));
                            noAttrMatch = false;
                            break;
                        }
                    }
                    if (noAttrMatch)
                        this.attributes.push(new AttributeMatch(name, EXISTING));
                    break;
                case PSEUDOS://todo: :not(), :nth-*()
                    this.pseudos.push(name);
            }
        };
        let state = TAG;
        let name = '';
        let inQuotes = false;
        for (let i = 0; i < selectorString.length; i++) {
            const char = selectorString[i];
            if (char === '\\') {
                name += selectorString[i + 1];
                i++;
                continue;
            }
            else if (char === '"')
                inQuotes = !inQuotes;
            else if (inQuotes) {
                name += char;
                continue;
            }
            let segmentEnd = true;
            let newState;
            if (char === '.')
                newState = CLASS;
            else if (char === '#')
                newState = ID;
            else if (char === '[')
                newState = ATTRIBUTES;
            else if (char === ']')
                newState = null;
            else if (char === ':')
                newState = PSEUDOS;
            else {
                segmentEnd = false;
                name += char;
            }
            if (segmentEnd) {
                saveSegment();
                state = newState;
                name = '';
            }
        }
        saveSegment();
    }
    findMatches(dom, recursive, matchSet) {
        if (recursive) {
            this.findMatches(dom, false, matchSet);
            for (const element of dom) {
                if (element instanceof parse_1.TextNode)
                    continue;
                this.findMatches(element.children, true, matchSet);
            }
            return;
        }
        elementLoop: for (const element of dom) {
            if (element instanceof parse_1.TextNode)
                continue;
            if (!(this.tagName === '*' || element.type.toLowerCase() === this.tagName))
                continue;
            for (const className of this.classes) {
                if (!element.classes.has(className))
                    continue elementLoop;
            }
            if (this.id !== undefined && element.attributes.id !== this.id)
                continue;
            for (const attribute of this.attributes) {
                const attributeValue = element.attributes[attribute.attribute];
                switch (attribute.matchType) {
                    case EXISTING:
                        if (attributeValue === undefined)
                            continue elementLoop;
                        break;
                    case EQUALING:
                        if (attributeValue !== attribute.value)
                            continue elementLoop;
                        break;
                    case CONTAINING_WHOLE_WORD:
                        const containingMatch = new RegExp('(?:^|\\s|-)' + regexEscape(attribute.value) + '(?:\\s|-|$)');
                        if (!(typeof attributeValue === 'string' && containingMatch.test(attributeValue)))
                            continue elementLoop;
                        break;
                    case STARTING_WHOLE_WORD:
                        const startingMatch = new RegExp('^' + regexEscape(attribute.value) + '(?:\\s|-|$)');
                        if (!(typeof attributeValue === 'string' && startingMatch.test(attributeValue)))
                            continue elementLoop;
                        break;
                    case STARTING:
                        if (!(typeof attributeValue === 'string' && attributeValue.startsWith(attribute.value)))
                            continue elementLoop;
                        break;
                    case ENDING:
                        if (!(typeof attributeValue === 'string' && attributeValue.endsWith(attribute.value)))
                            continue elementLoop;
                        break;
                    case CONTAINING:
                        if (!(typeof attributeValue === 'string' && attributeValue.includes(attribute.value)))
                            continue elementLoop;
                }
            }
            for (let i = 0; i < this.pseudos.length; i++) {
                const pseudo = this.pseudos[i];
                switch (pseudo) {
                    case 'checked':
                        if (element.attributes.checked === undefined)
                            continue elementLoop;
                        break;
                    case 'disabled':
                        if (element.attributes.disabled === undefined)
                            continue elementLoop;
                        break;
                    case 'empty':
                        for (const child of element.children) {
                            if (!(child instanceof parse_1.TextNode && isWhiteSpace(child.text)))
                                continue elementLoop;
                        }
                        break;
                    case 'first-child':
                        if (!(element instanceof parse_1.HtmlTag &&
                            element.parent &&
                            element.parent.children.indexOf(element) === 0))
                            continue elementLoop;
                        break;
                    case 'first-of-type':
                    case 'last-of-type':
                    case 'only-of-type':
                        const allMatches = new Set;
                        this.pseudos.splice(i, 1);
                        this.findMatches(dom, false, allMatches);
                        this.pseudos.splice(i, 0, pseudo);
                        const [firstElement] = allMatches;
                        switch (pseudo) {
                            case 'first-of-type':
                                if (element !== firstElement)
                                    continue elementLoop;
                                break;
                            case 'last-of-type':
                                let lastMatch;
                                for (lastMatch of allMatches)
                                    ;
                                if (element !== lastMatch)
                                    continue elementLoop;
                                break;
                            case 'only-of-type':
                                if (!(allMatches.size === 1 && element === firstElement))
                                    continue elementLoop;
                        }
                        break;
                    case 'indeterminate':
                        switch (element.type) {
                            case 'input':
                                switch (element.attributes.type) {
                                    case 'checkbox':
                                        if (element.attributes.indeterminate === undefined)
                                            continue elementLoop;
                                        break;
                                    case 'radio':
                                        const thisName = element.attributes.name;
                                        if (typeof thisName !== 'string')
                                            continue elementLoop;
                                        for (const sibling of element.parent.children) {
                                            if (sibling instanceof parse_1.HtmlTag &&
                                                sibling.type === 'input' &&
                                                sibling.attributes.type === 'radio' &&
                                                sibling.attributes.name === thisName &&
                                                sibling.attributes.checked !== undefined)
                                                continue elementLoop;
                                        }
                                        break;
                                    default:
                                        continue elementLoop;
                                }
                                break;
                            case 'progress':
                                if (element.attributes.value && element.attributes.max)
                                    continue elementLoop;
                                break;
                            default:
                                continue elementLoop;
                        }
                        break;
                    case 'last-child':
                        const siblings = element.parent.children;
                        if (siblings[siblings.length - 1] !== element)
                            continue elementLoop;
                        break;
                    case 'only-child':
                        if (element.parent.children.length !== 1)
                            continue elementLoop;
                        break;
                    case 'optional':
                        if (element.attributes.required !== undefined)
                            continue elementLoop;
                        break;
                    case 'required':
                        if (element.attributes.required === undefined)
                            continue elementLoop;
                        break;
                    case 'root':
                        if (element.parent.parent !== null)
                            continue elementLoop;
                        break;
                    default:
                        throw new Error('Unknown pseudo-selector: ' + pseudo);
                }
            }
            matchSet.add(element);
        }
    }
}
class CommaSelector extends Selector {
    constructor(selectors) {
        super();
        this.selectors = selectors;
    }
    findMatches(dom, recursive, matchSet) {
        for (const selector of this.selectors)
            selector.findMatches(dom, recursive, matchSet);
    }
}
class DescendantSelector extends Selector {
    constructor(ancestor, descendant) {
        super();
        this.ancestor = ancestor;
        this.descendant = descendant;
    }
    findMatches(dom, recursive, matchSet) {
        const ancestorMatches = new Set;
        this.ancestor.findMatches(dom, recursive, ancestorMatches);
        for (const ancestorMatch of ancestorMatches) {
            if (ancestorMatch instanceof parse_1.TextNode)
                continue;
            this.descendant.findMatches(ancestorMatch.children, true, matchSet);
        }
    }
}
class DirectDescendantSelector extends Selector {
    constructor(parent, child) {
        super();
        this.parent = parent;
        this.child = child;
    }
    findMatches(dom, recursive, matchSet) {
        const parentMatches = new Set;
        this.parent.findMatches(dom, recursive, parentMatches);
        for (const parentMatch of parentMatches) {
            if (parentMatch instanceof parse_1.TextNode)
                continue;
            this.child.findMatches(parentMatch.children, false, matchSet);
        }
    }
}
class AdjacentSelector extends Selector {
    constructor(before, after) {
        super();
        this.before = before;
        this.after = after;
    }
    findMatches(dom, recursive, matchSet) {
        const beforeMatches = new Set;
        this.before.findMatches(dom, recursive, beforeMatches);
        for (const beforeMatch of beforeMatches) {
            if (beforeMatch instanceof parse_1.TextNode || !beforeMatch.parent)
                continue;
            const siblings = beforeMatch.parent.children;
            const next = siblings[siblings.indexOf(beforeMatch) + 1];
            if (next === undefined)
                continue;
            this.after.findMatches([next], false, matchSet);
        }
    }
}
class AfterSelector extends Selector {
    constructor(before, after) {
        super();
        this.before = before;
        this.after = after;
    }
    findMatches(dom, recursive, matchSet) {
        const beforeMatches = new Set;
        this.before.findMatches(dom, recursive, beforeMatches);
        for (const beforeMatch of beforeMatches) {
            const siblings = beforeMatch.parent.children;
            const afterSiblings = siblings.slice(siblings.indexOf(beforeMatch) + 1);
            this.after.findMatches(afterSiblings, false, matchSet);
        }
    }
}
function makeSelector(str) {
    for (let i = 1; i + 1 < str.length; i++) {
        if (str[i] === ' ' && (isSeparator(str[i - 1]) || isSeparator(str[i + 1]))) {
            str = str.substring(0, i) + str.substring(i + 1);
            i--;
        }
    }
    const selectors = [];
    for (const selectorString of str.split(',')) {
        let selectorStart = 0;
        const selectorPieces = [];
        let insideBrackets = 0, insideQuotes = false;
        for (let i = 0; i < selectorString.length; i++) {
            const char = selectorString[i];
            if (isSeparator(char) && !(insideBrackets || insideQuotes)) {
                selectorPieces.push({
                    selector: new SingleSelector(selectorString.substring(selectorStart, i)),
                    separator: char
                });
                selectorStart = i + 1;
            }
            else if (selectorString[i] === '\\')
                i++;
            else if (char === '"')
                insideQuotes = !insideQuotes;
            else if (!insideQuotes) {
                if (char === '[')
                    insideBrackets++;
                else if (char === ']')
                    insideBrackets--;
            }
        }
        let selector = new SingleSelector(selectorString.substring(selectorStart));
        for (let i = selectorPieces.length - 1; i > -1; i--) {
            const selectorPiece = selectorPieces[i];
            switch (selectorPiece.separator) {
                case ' ':
                    selector = new DescendantSelector(selectorPiece.selector, selector);
                    break;
                case '>':
                    selector = new DirectDescendantSelector(selectorPiece.selector, selector);
                    break;
                case '+':
                    selector = new AdjacentSelector(selectorPiece.selector, selector);
                    break;
                case '~':
                    selector = new AfterSelector(selectorPiece.selector, selector);
            }
        }
        selectors.push(selector);
    }
    return new CommaSelector(selectors);
}
exports.default = (dom, selectorString) => {
    if (!(dom instanceof Array))
        dom = [dom];
    const selector = makeSelector(selectorString);
    const matches = new Set;
    selector.findMatches(dom, true, matches);
    return matches;
};
