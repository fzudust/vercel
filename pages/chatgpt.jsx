import Head from "next/head";
import { useState, useRef } from "react";
import { Button, Input, message } from 'antd';
import { SendOutlined, ClearOutlined } from '@ant-design/icons';
import Markdown from '../components/markdown';
import styles from "../styles/chatgpt.module.css";

const { TextArea } = Input;

export default function Home() {
  const [input, setInput] = useState();
  const [currentRes, setCurrentRes] = useState('');
  const [messages, setMessages] = useState([]);

  const messagesRef = useRef([]);
  const currentResRef = useRef('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event) {
    event.preventDefault();
    if (loading || !input) return;
    setLoading(true);
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
      message.error(error);
    }
    setLoading(false);
  }

  const clear = () => {
    setMessages([]);
    messagesRef.current = [];
  }

  return (
    <>
      <Head>
        <title>ChatGPT</title>
        <link rel="icon" href="/favicon.svg" />
      </Head>

      <div className={styles.content}>
        <h3 style={{ textAlign: 'center' }}>ChatGPT</h3>
        <ul className={styles.msg}>
          {messages.map(item => (
            <li key={item.id} className={item.role === 'assistant' ? styles.completion : styles.prompt}>
              <div className={styles.inner}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img width="30" src={item.role === 'assistant' ? '/ai-avatar.jpg' : '/user-avatar.jpg'} />
                {item.role === 'assistant' ? <Markdown source={item.content} /> : <span className={styles.msgdetail}>{item.content}</span>}
                {/* <span className={styles.msgdetail}>{item.content}</span> */}
              </div>
            </li>
          ))}
          {currentRes && (
            <li className={styles.completion}>
              <div className={styles.inner}>
                {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
                <img width="30" src="/ai-avatar.jpg" />
                <span className={styles.msgdetail}>{currentRes}</span>
              </div>
            </li>
          )}
        </ul>
        <div className={styles.input}>
          <div className={styles.inner}>
            <TextArea
              rows={4}
              showCount
              name="提问"
              placeholder="问ChatGPT"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={onSubmit}
              disabled={loading}
            />
            <div>
              <Button loading={loading} type="primary" icon={<SendOutlined />} onClick={onSubmit} style={{ margin: '10px' }}>发送</Button>
              <Button icon={<ClearOutlined />} onClick={clear} style={{ margin: '10px' }}>清理</Button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
