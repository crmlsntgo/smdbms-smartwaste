import React, { useEffect } from 'react';

const Toast = ({ message, show, type = 'success', onClose, duration = 3000 }) => {
  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!show) return null;

  const isError = type === 'error' || type === 'delete';
  
  // Styles based on type
  // Semi-transparent Green/Red backgrounds with Dark borders
  const bg = isError ? 'rgba(254, 226, 226, 0.95)' : 'rgba(209, 250, 229, 0.95)';
  const border = isError ? '1px solid #b91c1c' : '1px solid #047857';
  const color = isError ? '#991b1b' : '#065f46';

  return (
    <div
      style={{
        position: 'fixed',
        top: '80px', // Below 64px header
        right: '20px',
        backgroundColor: bg,
        color: color,
        border: border,
        padding: '12px 24px',
        borderRadius: '8px',
        zIndex: 9999,
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        minWidth: '250px',
        animation: 'slideIn 0.3s ease-out',
        fontWeight: '500'
      }}
    >
      <span>{message}</span>
      <button 
        onClick={onClose}
        style={{
          marginLeft: '15px',
          background: 'none',
          border: 'none',
          color: color,
          cursor: 'pointer',
          fontSize: '18px',
          padding: '0',
          lineHeight: '1',
          opacity: 0.8
        }}
      >
        &times;
      </button>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default Toast;
