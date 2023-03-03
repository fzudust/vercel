import Head from "next/head";
import { useState } from "react";
import styles from "../styles/chatgpt.module.css";

export default function Home() {
  const [input, setInput] = useState();
  const [currentRes, setCurrentRes] = useState();
  const [messages, setMessages] = useState([]);

  async function onSubmit(event) {
    event.preventDefault();
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: messages.concat([{ role: 'user', content: input }]) }),
      });

      if (!response.ok) {
        throw new Error(response.statusText);
      }
      const data = response.body;
      if (!data) {
        throw new Error('No data');
      }
      const reader = data.getReader();
      const decoder = new TextDecoder('utf-8');
      let done = false;

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        if (value) {
          let char = decoder.decode(value);
          setCurrentRes(item => {
            if (char === '\n' && item.endsWith('\n')) {
              return item;
            }
            if (char) {
              return item + char;
            }
          })
        }
        done = readerDone
      }
      setCurrentRes(item => {
        setMessages([...messages, {
          role: 'assistant',
          content: item,
        }]);
        return '';
      })
      setInput('')
      // setLoading(false)
    } catch (error) {
      console.error(error);
    }
  }

  return (
    <div>
      <Head>
        <title>ChatGPT</title>
      </Head>

      <main className={styles.main}>
        <h3>ChatGPT</h3>
        {messages.map(item => <div key={item.content} className={styles.result}>{item.content}</div>)}
        <form onSubmit={onSubmit}>
          <input
            type="text"
            name="animal"
            placeholder="Enter an animal"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <input type="submit" value="提问" />
        </form>
        <div className={styles.result}>{currentRes}</div>


      </main>
    </div>
  );
}
