import React, { useState } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';
import VoiceChat from './VoiceChat';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleContentGenerated = (content: any) => {
    // You can handle the generated content here
    // For example, show a notification or navigate to the content generator
    console.log('Content generated via voice:', content);
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-y-auto bg-gray-50 dark:bg-gray-900 p-3 sm:p-6">
          {children}
        </main>
      </div>
      
      {/* Voice Chat Component - now gets token from useAuth hook internally */}
      <VoiceChat onContentGenerated={handleContentGenerated} />
    </div>
  );
};

export default Layout;