
import React from 'react';
import { Classroom, Assignment } from './types';

// Map of classroom IDs to their first assignment for dashboard display
const CLASSROOM_FIRST_ASSIGNMENTS: Record<string, { title: string; dueDate: string }> = {
  'phys-101': { title: 'Lab 01: Vector Analysis', dueDate: 'Friday, Oct 24' },
  'calc-bc': { title: 'Limits Practice Set', dueDate: 'Friday, Oct 24' },
  'bio-ap': { title: 'Cell Structure Diagram', dueDate: 'Friday, Oct 24' },
  'hist-101': { title: 'Ancient Egypt Research', dueDate: 'Friday, Oct 24' },
};

interface DashboardProps {
  classrooms: Classroom[];
  onSelectClass: (id: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ classrooms, onSelectClass }) => {
  return (
    <div className="p-6 sm:p-10 max-w-[1400px] mx-auto animate-in slide-in-from-bottom-6 duration-700">
      <div className="flex flex-col gap-8">
        <header className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Your Learning Spaces</h2>
          <p className="text-[14px] font-bold text-slate-400 uppercase tracking-[0.2em]">Academic Control Center</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {classrooms.map((room) => {
            const assignment = CLASSROOM_FIRST_ASSIGNMENTS[room.id];
            const dueText = assignment?.dueDate ? assignment.dueDate.split(',')[0].toUpperCase().replace('FRIDAY', 'DUE FRIDAY').replace('MONDAY', 'DUE MONDAY').replace('WEDNESDAY', 'DUE WEDNESDAY') : 'NO UPCOMING';

            return (
              <div
                key={room.id}
                className="bg-white rounded-[2.5rem] overflow-hidden flex flex-col h-[340px] group cursor-default shadow-xl shadow-slate-100 border border-slate-200/60 hover:shadow-2xl hover:shadow-indigo-100 hover:-translate-y-2 transition-all duration-500"
              >
                <div
                  onClick={() => onSelectClass(room.id)}
                  className={`h-[140px] ${room.bannerColor} p-6 flex flex-col justify-end relative cursor-pointer overflow-hidden`}
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10 blur-2xl group-hover:bg-white/20 transition-all"></div>

                  <div className="absolute top-4 right-4">
                    <button className="w-10 h-10 bg-black/10 backdrop-blur-md border border-white/20 flex items-center justify-center rounded-xl text-white hover:bg-white/20 transition-all" onClick={(e) => { e.stopPropagation(); }}>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" /></svg>
                    </button>
                  </div>

                  <div className="relative z-10">
                    <h4 className="font-black text-[22px] text-white tracking-tight leading-tight group-hover:drop-shadow-lg transition-all line-clamp-2">{room.name}</h4>
                    <p className="text-[12px] text-white/80 font-bold uppercase tracking-widest mt-1">{room.section}</p>
                  </div>
                </div>

                <div className="flex-1 p-6 flex flex-col justify-between bg-white relative">
                  <div className="absolute top-[-32px] right-6 w-16 h-16 rounded-2xl border-4 border-white bg-slate-50 overflow-hidden shadow-xl shadow-slate-200/50 group-hover:scale-110 transition-transform duration-500">
                    <img src={`https://api.dicebear.com/7.x/pixel-art/svg?seed=${room.id}`} alt="Teacher" className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 pt-2">
                    <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-3">Next Action</div>
                    {assignment ? (
                      <div className="space-y-1">
                        <div className="text-[10px] font-black text-indigo-600 bg-indigo-50 inline-block px-2 py-0.5 rounded-full mb-1">{dueText}</div>
                        <div className="font-black text-[15px] text-slate-800 line-clamp-2 hover:text-indigo-600 cursor-pointer transition-colors" onClick={() => onSelectClass(room.id)}>{assignment.title}</div>
                      </div>
                    ) : (
                      <div className="text-slate-400 font-bold italic text-[13px]">Curriculum Optimized</div>
                    )}
                  </div>

                  <div className="h-14 border-t border-slate-100 flex justify-between items-center -mx-6 px-6 mt-4 bg-slate-50/30">
                    <p className="text-[12px] font-bold text-slate-400 group-hover:text-slate-600 transition-colors uppercase tracking-tighter">Instructor: {room.teacher}</p>
                    <div className="flex gap-1">
                      <button title="Your Work" className="w-10 h-10 flex items-center justify-center hover:bg-white hover:shadow-md rounded-xl text-slate-400 hover:text-indigo-600 transition-all" onClick={() => onSelectClass(room.id)}>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
