"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation"; // Added useSearchParams
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send, Loader2, User, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import NavBar from "@/components/NavBar";
import ItemPostModal from "@/components/ItemPostModal";

export default function ChatPage() {
  const router = useRouter();
  const searchParams = useSearchParams(); // To read the ?id= from the URL
  const [user, setUser] = useState(null);
  const [view, setView] = useState('list');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [visibleTimes, setVisibleTimes] = useState({});

  const messagesEndRef = useRef(null);
  const selectedChatIdRef = useRef(null);

  useEffect(() => { 
    getUser(); 
  }, []);

  // Sync ref with state
  useEffect(() => {
    selectedChatIdRef.current = selectedConversation?.id || null;
  }, [selectedConversation]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // --- NEW: Deep Linking Logic ---
  // This effect runs whenever the list of conversations is loaded OR the URL ID changes
  useEffect(() => {
    const chatIdFromUrl = searchParams.get('id');
    if (chatIdFromUrl && conversations.length > 0) {
      const targetChat = conversations.find(c => c.id === chatIdFromUrl);
      if (targetChat && selectedConversation?.id !== chatIdFromUrl) {
        selectConversation(targetChat);
      }
    }
  }, [searchParams, conversations]);
  // -------------------------------

  const getUser = async () => {
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      setUser(authUser);
      await fetchConversations(authUser.id); // Wait for conversations to load
    }
    setLoading(false);
  };

  /**
   * REALTIME SUBSCRIPTION
   */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('public-messages-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          fetchConversations(user.id);
          if (String(payload.new.chat_id) === String(selectedChatIdRef.current)) {
            setMessages((prev) => {
              const exists = prev.some(m => m.id === payload.new.id);
              return exists ? prev : [...prev, payload.new];
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchConversations = async (userId) => {
    const currentUserId = userId || user?.id;
    if (!currentUserId) return;

    const { data: chatsData, error } = await supabase
      .from("chats")
      .select(`id, item_id, finder_id, claimer_id, created_at, messages(id, content, created_at, sender_id)`)
      .or(`finder_id.eq.${currentUserId},claimer_id.eq.${currentUserId}`);

    if (error) return;

    const itemIds = [...new Set(chatsData.map(c => c.item_id).filter(Boolean))];
    const profileIds = [...new Set(chatsData.flatMap(c => [c.finder_id, c.claimer_id]).filter(Boolean))];

    const [{ data: itemsData }, { data: profilesData }] = await Promise.all([
      supabase.from('items').select('id, title').in('id', itemIds),
      supabase.from('profiles').select('id, full_name, avatar_url').in('id', profileIds)
    ]);

    const itemMap = itemsData?.reduce((acc, i) => ({ ...acc, [i.id]: i }), {}) || {};
    const profileMap = profilesData?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {};

    const mapped = chatsData.map(chat => {
      const isFinder = chat.finder_id === currentUserId;
      const otherUser = isFinder ? profileMap[chat.claimer_id] : profileMap[chat.finder_id];
      const sortedMsgs = (chat.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestMsg = sortedMsgs[0];
      
      return {
        id: chat.id,
        itemId: chat.item_id,
        itemTitle: itemMap[chat.item_id]?.title || "Item",
        otherUserId: otherUser?.id,
        otherUser: otherUser || { full_name: "Unknown", avatar_url: null },
        lastMessage: latestMsg
          ? (latestMsg.sender_id === currentUserId ? `You: ${latestMsg.content}` : latestMsg.content)
          : "New conversation",
        lastMessageTime: new Date(latestMsg?.created_at || chat.created_at),
        isFinder,
      };
    }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    setConversations(mapped);
  };

  const selectConversation = async (conv) => {
    setSelectedConversation(conv);
    setView('chat');
    
    const { data: history, error } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', conv.id)
      .order('created_at', { ascending: true });
    
    if (!error) setMessages(history || []);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    const content = newMessage.trim();
    setNewMessage("");

    const { data, error } = await supabase.from("messages").insert({
      sender_id: user.id,
      receiver_id: selectedConversation.otherUserId,
      chat_id: selectedConversation.id,
      item_id: selectedConversation.itemId,
      content,
      is_read: false
    }).select().single();

    if (error) return;

    if (data) {
      setMessages((prev) => [...prev, data]);
      fetchConversations(user.id);
    }
  };

  const backToList = () => {
    // Clear URL when going back
    router.push('/chat'); 
    setView('list');
    setSelectedConversation(null);
    setMessages([]);
  };

  const toggleTime = (msgId) => {
    setVisibleTimes(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleFileSelected = (file) => {
    const previewUrl = URL.createObjectURL(file);
    setShowPostModal(false);
    router.push(`/post?preview=${encodeURIComponent(previewUrl)}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] text-white flex flex-col font-sans overflow-hidden">
      {view === 'list' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto pb-24">
          <div className="p-6">
            <h1 className="text-2xl font-bold bg-linear-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Messages</h1>
          </div>
          <div className="px-6 space-y-4">
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className="w-full bg-black/30 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4 hover:bg-orange-500/10 transition-all text-left"
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-full border border-orange-500/30 overflow-hidden shrink-0">
                  {conv.otherUser?.avatar_url
                    ? <img src={conv.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User size={20} className="text-orange-400" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{conv.otherUser?.full_name}</p>
                  <p className="text-sm text-orange-300/60 truncate">{conv.lastMessage}</p>
                </div>
                <div className="text-[10px] text-orange-400/40 shrink-0 uppercase">
                  {conv.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col h-screen overflow-hidden">
          <div className="flex items-center p-4 border-b border-orange-500/10 bg-black/40 backdrop-blur-md">
            <button onClick={backToList} className="p-2 mr-2"><ArrowLeft size={22} className="text-orange-400" /></button>
            <div className="flex-1">
              <h2 className="font-bold text-base leading-tight">{selectedConversation?.otherUser?.full_name}</h2>
              <p className="text-[10px] text-orange-400/60 uppercase tracking-wider">{selectedConversation?.itemTitle}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-transparent">
            {messages.map((msg) => {
              const isMe = msg.sender_id === user.id;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  <div className="flex flex-col max-w-[75%]">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => toggleTime(msg.id)}
                      className={`px-4 py-2 rounded-2xl text-[15px] ${isMe ? 'bg-orange-600 rounded-br-none' : 'bg-white/10 rounded-bl-none shadow-lg'}`}
                    >
                      {msg.content}
                    </motion.div>
                    {visibleTimes[msg.id] && (
                      <span className="text-[9px] text-white/30 mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-lg">
            <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-1 border border-white/10 focus-within:border-orange-500/40">
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Message"
                className="flex-1 bg-transparent py-3 focus:outline-none text-sm"
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
              />
              <button onClick={sendMessage} className="text-orange-500 p-2"><Send size={20} /></button>
            </div>
          </div>
        </div>
      )}
      <ItemPostModal open={showPostModal} onClose={() => setShowPostModal(false)} onFileSelect={handleFileSelected} />
      {view === 'list' && <NavBar activePage="chat" onPlusClick={() => setShowPostModal(true)} />}
    </div>
  );
}