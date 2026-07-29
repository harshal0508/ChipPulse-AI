import { BrowserRouter, Routes, Route } from 'react-router-dom';
import React from 'react';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Workspace from './pages/Workspace';
import Analytics from './pages/Analytics';
import Projects from './pages/Projects';
import Profile from './pages/Profile';
import Navbar from './components/layout/Navbar';
import AchievementSystem from './components/gamification/AchievementSystem';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: 'white', background: '#990000', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h1>Fatal React Error</h1>
          <pre>{this.state.error?.toString()}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AchievementSystem />
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/workspace" element={<><Navbar /><Workspace /></>} />
          <Route path="/analytics" element={<><Navbar /><Analytics /></>} />
          <Route path="/projects" element={<><Navbar /><Projects /></>} />
          <Route path="/profile" element={<><Navbar /><Profile /></>} />
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
export default App;
