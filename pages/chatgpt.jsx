import Head from "next/head";
import { useState, useRef } from "react";
import styles from "../styles/chatgpt.module.css";

export default function Home() {
  const [input, setInput] = useState();
  const [currentRes, setCurrentRes] = useState('');
  const [messages, setMessages] = useState([]);

  const messagesRef = useRef([]);
  const currentResRef = useRef('');
  const loadingRef = useRef(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (loadingRef.current || !input) return;
    loadingRef.current = true;
    messagesRef.current = [...messagesRef.current, { role: 'user', content: input, id: Date.now() }]
    setMessages(messagesRef.current);
    setInput('')
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: messagesRef.current.map(item => ({ role: item.role, content: item.content })) }),
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
          char = char.replace(/\n/ig, '')
          if (!char) continue
          currentResRef.current = currentResRef.current + char;
          setCurrentRes(currentResRef.current)
        }
        done = readerDone
      }
      messagesRef.current = [...messagesRef.current, { role: 'assistant', content: currentResRef.current, id: Date.now() }];
      setMessages(messagesRef.current);
      setCurrentRes('');
      currentResRef.current = '';
    } catch (error) {
      console.error(error);
    }
    loadingRef.current = false;
  }

  const clear = () => {
    setMessages([]);
    messagesRef.current = [];
  }

  return (
    <>
      <Head>
        <title>ChatGPT</title>
      </Head>

      <div className={styles.content}>
        <ul className={styles.msg}>
          {messages.map(item => (
            <li key={item.id} className={item.role === 'assistant' ? styles.completion : styles.prompt}>
              <div className={styles.inner}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img width="30" src={item.role === 'assistant' ? 'https://www.chat2ai.cn/images/ai-avatar.jpg' : 'https://www.chat2ai.cn/images/user-avatar.jpg'} />
                <span className={styles.msgdetail}>{item.content}</span>
              </div>
            </li>
          ))}
          {currentRes && (
            <li className={styles.completion}>
              <div className={styles.inner}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img width="30" src="https://www.chat2ai.cn/images/ai-avatar.jpg" />
                <span className={styles.msgdetail}>{currentRes}</span>
              </div>
            </li>
          )}
        </ul>
        <div className={styles.input}>
          <div className={styles.inner}>
            <div>
              <button className={styles.btnresponse} onClick={clear}>清理</button>
            </div>
            <div className={styles.relative}>
              <form onSubmit={onSubmit}>
                <input
                  type="text"
                  name="提问"
                  placeholder="问ChatGPT"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <div className={styles.send} onClick={onSubmit} ></div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
