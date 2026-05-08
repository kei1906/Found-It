'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Camera, User, ChevronRight, LogOut, Trash2, X, Send, Loader2, ArrowLeft, Lock, Bell, MessageSquare, Tag as TagIcon, Smartphone } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  
  // Notification States
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [notifSettings, setNotifSettings] = useState({
    chatMessages: true,
    itemUpdates: true,
    browserAlerts: false
  });

  const [profile, setProfile] = useState({
    full_name: "",
    student_number: "",
    email: "",
    avatar_url: ""
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const router = useRouter();

  // Load notification settings from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('foundit_notif_settings');
    if (saved) {
      setNotifSettings(JSON.parse(saved));
    }
  }, []);

  const getProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, student_number, email, avatar_url')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile({
            full_name: data.full_name || "LSPU Student",
            student_number: data.student_number || "No ID Set",
            email: data.email || user.email,
            avatar_url: data.avatar_url || ""
          });
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    getProfile();
  }, [getProfile]);

  // Toggle handlers for notifications
  const toggleSetting = (key) => {
    const updated = { ...notifSettings, [key]: !notifSettings[key] };
    setNotifSettings(updated);
    localStorage.setItem('foundit_notif_settings', JSON.stringify(updated));
    
    // Request permission if enabling browser alerts
    if (key === 'browserAlerts' && updated.browserAlerts) {
      if ("Notification" in window) {
        Notification.requestPermission();
      }
    }
  };

  const handleUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleChangePassword = async () => {
    setPasswordMsg('');
    if (newPassword.length < 6) { setPasswordMsg('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg('Passwords do not match.'); return; }
    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg('✅ Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setShowPasswordModal(false); setPasswordMsg(''); }, 1500);
    } catch (err) {
      setPasswordMsg(`❌ ${err.message}`);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch('/api/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Failed to delete account');

      // Sign out locally and redirect
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      alert("Error deleting account: " + error.message);
      setLoading(false);
      setShowDeleteModal(false);
    }
  };


  if (loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white bg-black">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-medium opacity-50">Loading profile...</p>
    </div>
  );

  return (
    <div className="min-h-screen text-white pb-20 font-sans bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
      <div className="sticky top-0 z-20 backdrop-blur-md bg-black/40 border-b border-orange-500/20 px-6 pt-4 pb-6 flex items-center justify-between">
        <button onClick={() => router.push('/Home')} className="p-2 hover:bg-white/5 rounded-full transition text-orange-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight text-orange-400">Profile</h1>
        <div className="w-10" />
      </div>

      <main className="px-6 mt-10 max-w-lg mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-black/40 border border-orange-500/30 p-8 flex flex-col items-center shadow-2xl shadow-orange-500/10">

          <div className="relative mb-4 group">
            <div className="w-32 h-32 rounded-full bg-black border-2 border-orange-500/50 flex items-center justify-center overflow-hidden relative shadow-inner">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={64} className="text-orange-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-orange-500 p-2.5 rounded-full border-4 border-black cursor-pointer hover:bg-orange-600 transition-colors z-10 shadow-lg">
              <Camera size={18} className="text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">{profile.full_name}</h2>
            <div className="inline-block text-orange-300 text-[10px] uppercase tracking-widest font-bold bg-orange-500/10 px-4 py-1.5 rounded-full border border-orange-500/20">
              Verified LSPU Account
            </div>
            <div className="pt-2">
              <p className="text-orange-300 font-mono text-sm tracking-[0.2em] uppercase font-semibold">
                {profile.student_number}
              </p>
              <p className="text-orange-300/60 text-xs font-medium tracking-wide">
                {profile.email}
              </p>
            </div>
          </div>
        </motion.div>

        <div className="rounded-3xl bg-black/40 border border-orange-500/30 overflow-hidden">
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between px-6 py-5 border-b border-orange-500/20 hover:bg-orange-500/5 transition-all group text-orange-300"
          >
            <div className="flex items-center gap-4">
              <Lock size={20} className="opacity-40" />
              <span className="font-medium text-lg">Change Password</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>

          {/* Fixed Notification Settings Button */}
          <button 
            onClick={() => setShowNotifModal(true)}
            className="w-full flex items-center justify-between px-6 py-5 border-b border-orange-500/20 hover:bg-orange-500/5 transition-all group text-orange-300"
          >
            <div className="flex items-center gap-4">
              <Bell size={20} className="opacity-40" />
              <span className="font-medium text-lg">Notification Settings</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>

          <button onClick={handleLogout} className="w-full flex items-center justify-between px-6 py-5 border-b border-orange-500/20 hover:bg-orange-500/5 transition-all group text-orange-300">
            <div className="flex items-center gap-4">
              <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
              <span className="font-semibold text-lg">Log Out</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>

          <button onClick={() => setShowDeleteModal(true)} className="w-full flex items-center justify-between px-6 py-5 hover:bg-red-500/5 transition-all group text-red-400/80">
            <div className="flex items-center gap-4">
              <Trash2 size={20} />
              <span className="font-semibold text-lg">Delete Account</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>
        </div>
      </main>

      <AnimatePresence>
        {/* Notification Modal */}
        {showNotifModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-neutral-900 border border-orange-500/30 p-8 rounded-[2.5rem] w-full max-w-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 bg-orange-500/10 rounded-2xl">
                  <Bell className="text-orange-400" size={24} />
                </div>
                <h3 className="text-xl font-bold">Preferences</h3>
              </div>
              
              <div className="space-y-4">
                <NotifToggle 
                  icon={<MessageSquare size={18} />} 
                  label="Chat Messages" 
                  desc="When someone sends you a message"
                  active={notifSettings.chatMessages} 
                  onToggle={() => toggleSetting('chatMessages')}
                />
                <NotifToggle 
                  icon={<TagIcon size={18} />} 
                  label="Item Updates" 
                  desc="New items in your area"
                  active={notifSettings.itemUpdates} 
                  onToggle={() => toggleSetting('itemUpdates')}
                />
                <NotifToggle 
                  icon={<Smartphone size={18} />} 
                  label="Browser Alerts" 
                  desc="Show desktop notifications"
                  active={notifSettings.browserAlerts} 
                  onToggle={() => toggleSetting('browserAlerts')}
                />

                <button onClick={() => setShowNotifModal(false)} className="w-full py-4 mt-4 bg-orange-500 hover:bg-orange-600 rounded-2xl font-bold transition-all">
                  Done
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Existing Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/60 border border-orange-500/30 p-8 rounded-[2.5rem] w-full max-w-xs">
              <h3 className="text-xl font-bold mb-1">Change Password</h3>
              <p className="text-orange-300/50 text-xs mb-6">Must be at least 6 characters.</p>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-orange-500/20 p-4 rounded-2xl text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
                />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-orange-500/20 p-4 rounded-2xl text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
                />
                {passwordMsg && <p className="text-xs text-center text-orange-300/80 px-2">{passwordMsg}</p>}
                <button onClick={handleChangePassword} disabled={changingPassword} className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-2xl font-bold disabled:opacity-50 transition-all">
                  {changingPassword ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Update Password'}
                </button>
                <button onClick={() => { setShowPasswordModal(false); setPasswordMsg(''); setNewPassword(''); setConfirmPassword(''); }} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Existing Delete Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/80 z-100 flex items-center justify-center backdrop-blur-sm p-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/60 border border-orange-500/30 p-8 rounded-[2.5rem] w-full max-w-xs text-center">
              <Trash2 size={48} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Delete Account?</h3>
              <p className="text-sm text-orange-300/60 mb-8">This action is permanent.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleDeleteAccount} className="w-full py-4 bg-red-600 hover:bg-red-700 rounded-2xl font-bold">Yes, Delete</button>
                <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Helper component for the Notification Toggles
function NotifToggle({ icon, label, desc, active, onToggle }) {
  return (
    <div className="flex items-center justify-between group cursor-pointer" onClick={onToggle}>
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-xl ${active ? 'bg-orange-500/20 text-orange-400' : 'bg-white/5 text-white/20'}`}>
          {icon}
        </div>
        <div>
          <p className={`text-sm font-bold ${active ? 'text-white' : 'text-white/40'}`}>{label}</p>
          <p className="text-[10px] text-white/20">{desc}</p>
        </div>
      </div>
      <div className={`w-10 h-5 rounded-full relative transition-colors ${active ? 'bg-orange-500' : 'bg-white/10'}`}>
        <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${active ? 'right-1' : 'left-1'}`} />
      </div>
    </div>
  );
}