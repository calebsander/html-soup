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
export interface DataSet {
    [attr: string]: string;
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
    constructor({ type, attributes, children, parent }: HtmlParams);
    setChildren(children: Children): void;
    readonly child: TextNode | HtmlTag;
    readonly classes: Set<string>;
    readonly dataset: DataSet;
}
declare function parse(str: string | Buffer, trimText?: boolean): Children | HtmlTag | TextNode;
declare const _default: typeof parse & {
    HtmlTag: typeof HtmlTag;
    TextNode: typeof TextNode;
};
export default _default;
