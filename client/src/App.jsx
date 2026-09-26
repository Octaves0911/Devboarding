import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">DevBoarding — Phase 1 scaffold ready.</p>
      </div>
    </BrowserRouter>
  );
}
