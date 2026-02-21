
import React from 'react';
import { AppView, Classroom } from './types';

interface SidebarProps {
  activeView: AppView;
  setActiveView: (view: AppView) => void;
  onBackToHome: () => void;
  classrooms: Classroom[];
  onSelectClass: (id: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeView, setActiveView, onBackToHome, classrooms, onSelectClass }) => {
  return (
    <div className="flex flex-col h-full bg-white border-r border-slate-200/60 py-8">
      <div className="pb-6 mb-4 border-b border-slate-100">
        <button
          onClick={onBackToHome}
          className={`w-[90%] flex items-center gap-5 px-6 py-3.5 rounded-r-2xl text-[14px] font-black tracking-tight transition-all ${activeView === AppView.DASHBOARD ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'}`}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
          Dashboard
        </button>
        <button className="w-[90%] flex items-center gap-5 px-6 py-3.5 rounded-r-2xl text-[14px] font-black tracking-tight text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2-2v12a2 2 0 002 2z" /></svg>
          Calendar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto pt-4">
        <div className="px-8 py-2 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Enrolled Spaces</div>
        {classrooms.map(room => (
          <button
            key={room.id}
            onClick={() => onSelectClass(room.id)}
            className="w-[90%] flex items-center gap-4 px-6 py-3 rounded-r-2xl text-[14px] font-bold text-slate-600 hover:bg-indigo-50 hover:text-indigo-600 transition-all group"
          >
            <div className={`w-8 h-8 rounded-xl ${room.bannerColor} flex items-center justify-center font-black text-white text-[11px] shadow-sm group-hover:scale-110 transition-transform`}>{room.name[0]}</div>
            <span className="truncate">{room.name}</span>
          </button>
        ))}
      </div>

      <div className="mt-auto pt-6 border-t border-slate-100">
        <button className="w-[90%] flex items-center gap-5 px-6 py-3.5 rounded-r-2xl text-[14px] font-black tracking-tight text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-all">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          Settings
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
