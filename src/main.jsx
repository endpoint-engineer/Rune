import React from 'react';
import ReactDOM from 'react-dom';
import { RuneAppWrapper } from './App.jsx'; // or the filename you save from the canvas
ReactDOM.render(<RuneAppWrapper />, document.getElementById('root'));
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
