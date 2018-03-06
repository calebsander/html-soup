/// <reference types="node" />
export interface Attributes {
    [attr: string]: string | boolean | undefined;
}
export declare type Children = (HtmlTag | TextNode)[];
export interface HtmlParams {
    type: string;
    attributes: Attributes;
    children?: Children;
    parent: HtmlTag | null;
}
export declare class TextNode {
    readonly text: string;
    constructor(text: string);
}
export declare class HtmlTag {
    readonly type: string;
    readonly attributes: Attributes;
    children: Children;
    readonly parent: HtmlTag | null;
    private classSet;
    constructor({type, attributes, children, parent}: HtmlParams);
    setChildren(children: Children): void;
    readonly child: TextNode | HtmlTag;
    readonly classes: Set<string>;
}
declare const _default: ((str: string | Buffer, trimText?: boolean) => HtmlTag | TextNode | (HtmlTag | TextNode)[]) & {
    HtmlTag: typeof HtmlTag;
    TextNode: typeof TextNode;
};
export default _default;
