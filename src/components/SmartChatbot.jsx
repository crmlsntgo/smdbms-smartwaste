import React, { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, Send, Bot } from 'lucide-react';
import '../styles/components/smart-chatbot.css';

const BOT_RESPONSES = [
  {
    keywords: ['price', 'pricing', 'cost', 'plan', 'subscription', 'fee', 'how much'],
    response:
      'SmartWaste offers three plans: Starter (small facilities), Professional (multi-site organizations), and Enterprise (municipalities & large campuses). Pricing is based on the number of bins and sites. Would you like to request a custom quote?',
  },
  {
    keywords: ['deploy', 'setup', 'install', 'start', 'onboard', 'get started', 'begin', 'rollout'],
    response:
      'Most organizations are fully operational within 2–4 weeks. Our project team handles sensor provisioning, dashboard configuration, and staff onboarding. For large-scale municipal deployments, we offer a phased rollout plan.',
  },
  {
    keywords: ['integrate', 'api', 'connect', 'erp', 'system', 'connector', 'existing'],
    response:
      'SmartWaste provides a REST API and pre-built connectors for common ERP, CMMS, and facility management platforms. Our integrations team will map your data flows and ensure a seamless setup with your existing tools.',
  },
  {
    keywords: ['sensor', 'offline', 'broken', 'hardware', 'bin', 'device', 'not working'],
    response:
      'The platform monitors your sensor network 24/7 and flags issues automatically. Our support team can remotely diagnose most problems within hours. If hardware replacement is needed, a field technician can be dispatched.',
  },
  {
    keywords: ['secure', 'security', 'gdpr', 'data', 'privacy', 'compliant', 'compliance', 'soc'],
    response:
      'SmartWaste is SOC 2 Type II certified and fully GDPR-compliant. All data is encrypted in transit and at rest. We support data residency requirements for organizations in regulated industries.',
  },
  {
    keywords: ['demo', 'trial', 'test', 'see', 'show', 'preview'],
    response:
      "We'd love to show you SmartWaste in action! You can request a live demo tailored to your organization's use case. Our sales team typically schedules demos within 48 hours. Shall I connect you?",
  },
  {
    keywords: ['municipality', 'city', 'government', 'public', 'campus', 'university', 'school'],
    response:
      'SmartWaste is purpose-built for public institutions. It supports multi-site dashboards, role-based access, regulatory reporting, and meets public sector procurement standards. We work with municipalities, universities, and government agencies worldwide.',
  },
  {
    keywords: ['multi', 'multiple', 'sites', 'locations', 'facilities', 'branches'],
    response:
      'Yes — SmartWaste is built for multi-site operations. A single dashboard gives you visibility across all locations, with role-based access controls and centralized reporting for your entire organization.',
  },
  {
    keywords: ['support', 'help', 'contact', 'human', 'agent', 'person', 'team', 'talk'],
    response:
      'Our support team is available Mon–Fri, 8 AM–5 PM EST. You can reach us at support@smartdustbin.com or call +1 (555) 555-5555. Enterprise clients have access to a 24/7 critical incident line.',
  },
  {
    keywords: ['route', 'collection', 'schedule', 'pickup', 'optimization'],
    response:
      "SmartWaste's Route Optimization module uses real-time fill-level data to generate the most efficient collection schedules, reducing unnecessary pickups and cutting operational costs by up to 30%.",
  },
  {
    keywords: ['report', 'analytics', 'dashboard', 'insight', 'data', 'metric'],
    response:
      'The Analytics Dashboard provides real-time fill levels, collection frequency trends, cost-per-pickup breakdowns, waste diversion rates, and carbon impact estimates — all exportable for internal reporting or regulatory compliance.',
  },
  {
    keywords: ['hello', 'hi', 'hey', 'good morning', 'good afternoon', 'howdy'],
    response:
      "Hello! 👋 I'm the SmartWaste support assistant. I can answer questions about our platform, pricing, deployment, integrations, and more. What would you like to know?",
  },
  {
    keywords: ['thank', 'thanks', 'great', 'helpful', 'perfect', 'awesome'],
    response:
      "You're welcome! Is there anything else I can help you with? If you'd like to speak with a member of our team directly, feel free to email us at support@smartdustbin.com.",
  },
];

const QUICK_REPLIES = [
  'How do I get started?',
  "What's the pricing?",
  'Can it integrate with our systems?',
  'Is my data secure?',
  'Request a demo',
];

const WELCOME_MESSAGE = {
  id: 0,
  from: 'bot',
  text: "Hi there! 👋 I'm the SmartWaste support assistant. Ask me anything about our platform — deployment, pricing, integrations, security, and more.",
  timestamp: new Date(),
};

function getBotResponse(input) {
  const lower = input.toLowerCase();
  for (const entry of BOT_RESPONSES) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.response;
    }
  }
  return "That's a great question. For detailed information on that topic, I'd recommend reaching out to our team directly at support@smartdustbin.com or calling +1 (555) 555-5555. They'll be happy to help!";
}

export default function SmartChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [messages, isOpen]);

  const sendMessage = (text) => {
    if (!text.trim()) return;
    const userMsg = {
      id: Date.now(),
      from: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setShowQuickReplies(false);
    setIsTyping(true);
    setTimeout(
      () => {
        const botMsg = {
          id: Date.now() + 1,
          from: 'bot',
          text: getBotResponse(text),
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsTyping(false);
      },
      800 + Math.random() * 400
    );
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') sendMessage(input);
  };

  const handleOpen = () => {
    setIsOpen(true);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  return (
    <div className="chatbot-root">
      <div
        className={`chatbot-panel ${isOpen ? 'chatbot-panel--open' : ''}`}
        role="dialog"
        aria-label="SmartWaste support chat"
      >
        <div className="chatbot-header">
          <div className="chatbot-header-left">
            <div className="chatbot-avatar">
              <Bot size={16} color="#fff" />
            </div>
            <div>
              <p className="chatbot-header-title">SmartWaste Support</p>
              <div className="chatbot-header-status-row">
                <span className="chatbot-online-dot" />
                <span className="chatbot-header-status">
                  Online · Typically replies instantly
                </span>
              </div>
            </div>
          </div>
          <button
            className="chatbot-close-btn"
            onClick={handleClose}
            aria-label="Close chat"
          >
            <X size={16} />
          </button>
        </div>

        <div className="chatbot-messages">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`chatbot-msg-row ${msg.from === 'user' ? 'chatbot-msg-row--user' : ''}`}
            >
              {msg.from === 'bot' && (
                <div className="chatbot-bot-icon">
                  <Bot size={12} color="#059669" />
                </div>
              )}
              <div
                className={`chatbot-bubble ${msg.from === 'user' ? 'chatbot-bubble--user' : 'chatbot-bubble--bot'}`}
              >
                {msg.text}
              </div>
            </div>
          ))}

          {isTyping && (
            <div className="chatbot-msg-row">
              <div className="chatbot-bot-icon">
                <Bot size={12} color="#059669" />
              </div>
              <div className="chatbot-bubble chatbot-bubble--bot chatbot-typing">
                <span />
                <span />
                <span />
              </div>
            </div>
          )}

          {showQuickReplies && !isTyping && (
            <div className="chatbot-quick-replies">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr}
                  className="chatbot-quick-chip"
                  onClick={() => sendMessage(qr)}
                >
                  {qr}
                </button>
              ))}
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="chatbot-input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question…"
            className="chatbot-input"
            maxLength={300}
          />
          <button
            className="chatbot-send-btn"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isTyping}
            aria-label="Send message"
          >
            <Send size={15} />
          </button>
        </div>
      </div>

      <button
        className={`chatbot-fab ${isOpen ? 'chatbot-fab--open' : ''}`}
        onClick={isOpen ? handleClose : handleOpen}
        aria-label={isOpen ? 'Close chat' : 'Open support chat'}
      >
        <span
          className={`chatbot-fab-icon ${isOpen ? 'chatbot-fab-icon--close' : ''}`}
        >
          <MessageCircle size={24} />
        </span>
        <span
          className={`chatbot-fab-icon chatbot-fab-icon--x ${isOpen ? 'chatbot-fab-icon--x-visible' : ''}`}
        >
          <X size={22} />
        </span>
        {!isOpen && (
          <span className="chatbot-fab-badge" aria-hidden="true">
            1
          </span>
        )}
      </button>
    </div>
  );
}
