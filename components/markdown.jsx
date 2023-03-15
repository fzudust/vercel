import ReactDOMServer from "react-dom/server";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { coldarkDark } from "react-syntax-highlighter/dist/cjs/styles/prism";

const CodeBlock = ({ language, children }) => {
  return (
    <SyntaxHighlighter language={language} style={coldarkDark}>
      {children}
    </SyntaxHighlighter>
  );
};

export default function Markdown({ source }) {
  const html = source.replace(
    /(```([a-zA-Z]+)?\s*([\s\S]*?)```)|(`[^`]*`)/g,
    (match, codeBlock, lang, code, inlineCode) => {
      if (codeBlock) {
        const el = <CodeBlock language={lang}>{code}</CodeBlock>;
        return ReactDOMServer.renderToString(el);
        // return el;
      } else if (inlineCode) {
        const el = (
          // 这里属于remote HTML content，无法直接使用 chakra 的组件
          // https://chakra-ui.com/community/recipes/prose
          <code
            style={{
              backgroundColor: "#A0AEC0",
              // fontWeight: "bold",
              padding: "1px 4px",
              margin: "0px 4px",
              borderRadius: "2px",
            }}
          >
            {inlineCode.slice(1, -1)}
          </code>
        );
        return ReactDOMServer.renderToString(el);
        // return el;
      } else {
        return match;
      }
    }
  );

  return <div dangerouslySetInnerHTML={{ __html: html }} style={{ maxWidth: '100%' }} />;
};
