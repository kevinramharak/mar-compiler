
import { CharacterStream } from "@/CharacterStream";
import { EOFError } from "@/Error";
import { IToken, Token, TokenType } from "@/Token";
import { character } from "@/util";

import {
    parseFloatToken,
    parseMultiLineComment,
    parseNumberToken,
    parseSingleLineComment,
    sequences,
} from ".";

export interface TokenizerResult {
    tokens: IToken[];
    warnings: string[];
    errors: string[];
}

/**
 * The source file is decomposed into comments, sequences of whitespace characters (space, horizontal tab, new-line, vertical tab, and form-feed), and preprocessing tokens, which are the following
 *
 * - header names: <stdio.h> or "myfile.h"
 * - identifiers
 * - preprocessing numbers, which cover integer constants and floating constants, but also cover some invalid tokens such as 1..E+3.foo or 0JBK
 * - character constants and string literals
 * - operators and punctuators, such as +, <<=, <%, or ##.
 * - individual non-whitespace characters that do not fit in any other category
 *
 * Each comment is replaced by one space character
 *
 * Newlines are kept, and it's implementation-defined whether non-newline whitespace sequences may be collapsed into single space characters.
 */
export function tokenize(input: string, filename: string): TokenizerResult {
    const stream = new CharacterStream(input);

    const tokens: IToken[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    while (!stream.eof) {
        const char = stream.next();
        // #TODO: rewrite parse*() functions so they dont need the meta parameter
        const meta = { filename, line: stream.line, column: stream.column };

        // skip whitespace
        if (character.is.whitespace(char)) {
            continue;
        }

        // check for comments
        if (char === "/") {
            const next = stream.peek();
            if (next === "/") {
                stream.consume();
                parseSingleLineComment(stream);
                continue;
            } else if (next === "*") {
                stream.consume();
                parseMultiLineComment(stream);
                continue;
            }
        }

        let foundSequence = false;
        for (const sequence of sequences) {
            if (sequence.test(char, stream)) {
                for (let i = 1; i < sequence.length; i++) {
                    stream.consume();
                }
                const token = new Token(sequence.type, sequence.sequence, meta);
                tokens.push(token);
                foundSequence = true;
                break;
            }
        }
        if (foundSequence) {
            continue;
        }

        // we make a special case for '.' because it could be a floating point literal
        if (char === ".") {
            if (character.is.digit(stream.peek())) {
                // parsing is easier with an implied '0' in front of the '.'
                const token = parseFloatToken("0" + char, stream, meta);
                tokens.push(token);
                continue;
            } else { // just a dot
                tokens.push(new Token(TokenType.Dot, char, meta));
                continue;
            }
        }

        // numbers -> integers & floats
        if (character.is.digit(char)) {
            const token = parseNumberToken(char, stream, meta);
            tokens.push(token);
            continue;
        }

        if (char === "'" || char === '"') {
            const type = char;
            // const token = parseStringLiteral(type, stream, meta);
            // tokens.push(token);
            // continue;
        }
    }

    return {
        errors,
        tokens,
        warnings,
    };
}