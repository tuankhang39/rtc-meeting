import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Không dùng StrictMode: tránh getUserMedia bị gọi 2 lần (dễ lỗi cam trên Windows)
createRoot(document.getElementById('root')!).render(<App />)
