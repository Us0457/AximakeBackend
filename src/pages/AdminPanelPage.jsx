import React, { useEffect, useState } from 'react';
    import { supabase } from '../lib/supabaseClient';
    import { motion } from 'framer-motion';
    import { Button } from '@/components/ui/button';
    import { Input } from '@/components/ui/input';
    import { Textarea } from '@/components/ui/textarea';
    import { useToast } from '@/components/ui/use-toast';
    import { Edit, Trash2 } from 'lucide-react';
    import { useAuth } from '@/contexts/AuthContext';
    import { useNavigate } from 'react-router-dom';
    import { FaUsers, FaBoxOpen, FaClipboardList, FaUndo, FaTimesCircle } from 'react-icons/fa';
    import { useSpring, animated } from 'react-spring';
    import { getApiUrl, getPhpUrl } from '@/lib/utils';

    const ADMIN_UIDS = [
      '22e30fce-c81b-40d8-96f2-2d2291301b0d', // Your actual admin UID
      // Add more UIDs if you have multiple admins
    ];

    const requiredAddressFields = [
      'name', 'email', 'phone', 'flat_no', 'area', 'address', 'address_2', 'city', 'state', 'pincode', 'country'
    ];

    const initialAddress = {
      name: '',
      email: '',
      phone: '',
      flat_no: '',
      area: '',
      address: '',
      address_2: '',
      city: '',
      state: '',
      pincode: '',
      country: 'India',
    };

    const AdminPanelPage = () => {
      const { user } = useAuth();
      const navigate = useNavigate();
      const { toast } = useToast ? useToast() : { toast: () => {} };
      const [orders, setOrders] = useState([]);
      const [users, setUsers] = useState([]);
      const [loading, setLoading] = useState(true);
      const [error, setError] = useState(null);
      const [editingOrder, setEditingOrder] = useState(null);
      const [newOrder, setNewOrder] = useState({ file_name: '', material: '', color: '', infill: 0, price: 0, user_id: '', address: { ...initialAddress } });
      const [emailForm, setEmailForm] = useState({ to: '', subject: '', message: '' });
      const [sending, setSending] = useState(false);
      const [detailsOpen, setDetailsOpen] = useState({}); // { [orderId]: boolean }
      const [orderStatuses, setOrderStatuses] = useState({}); // { [orderId]: status }

      const [statusEmailLoading, setStatusEmailLoading] = useState({}); // { [orderId]: boolean }
      const [adminChecked, setAdminChecked] = useState(false);
      const [banners, setBanners] = useState([]);
      // --- Custom Print Page Settings Block ---
      const [customPrintMaterials, setCustomPrintMaterials] = useState([]);
      const [savingMaterials, setSavingMaterials] = useState(false);
      // --- Shiprocket Live Status Fetch ---
      const [liveStatus, setLiveStatus] = useState({});
      const [shiprocketStatusLoading, setShiprocketStatusLoading] = useState({});

      // Restrict access to admin UIDs only
      useEffect(() => {
        if (!user) {
          navigate('/');
          return;
        }
        if (!ADMIN_UIDS.includes(user.id)) {
          navigate('/');
          return;
        }
        setAdminChecked(true);
      }, [user, navigate]);

      // Fetch all orders (from 'orders' table, not 'quotes')
      useEffect(() => {
        const fetchOrders = async () => {
          setLoading(true);
          const { data, error } = await supabase.from('orders').select('*, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url').order('created_at', { ascending: false });
          if (error) setError('Failed to fetch orders.');
          else setOrders(data || []);
          setLoading(false);
        };
        fetchOrders();
        // Real-time subscription for new/updated orders
        const ordersSub = supabase
          .channel('public:orders')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
            fetchOrders();
          })
          .subscribe();
        return () => {
          supabase.removeChannel(ordersSub);
        };
      }, []);

      // Fetch all users
      useEffect(() => {
        const fetchUsers = async () => {
          // Fetch users from 'profiles' table instead of admin API
          const { data, error } = await supabase.from('profiles').select('id, email, created_at');
          if (error) setError('Failed to fetch users.');
          else setUsers(data || []);
        };
        fetchUsers();
      }, []);

      // Fetch discount banners for main page
      useEffect(() => {
        async function fetchBanners() {
          const { data } = await supabase.from("discount_banners").select("id, text, color").order("id");
          setBanners(data || []);
        }
        fetchBanners();
      }, []);

      // Update orderStatuses when orders change
      useEffect(() => {
        const statusMap = {};
        orders.forEach(order => {
          statusMap[order.id] = order.order_status || 'Pending';
        });
        setOrderStatuses(statusMap);
      }, [orders]);

      // CRUD: Create Order
      const handleCreateOrder = async (e) => {
        e.preventDefault();
        // Validate address fields
        for (const field of requiredAddressFields) {
          if (!newOrder.address[field]) {
            toast({ title: 'Missing Address Field', description: `Please fill in ${field}.`, variant: 'destructive' });
            return;
          }
        }
        // Build Shiprocket-compatible address
        const shiprocketAddress = {
          name: newOrder.address.name,
          email: newOrder.address.email,
          phone: newOrder.address.phone,
          address: `${newOrder.address.flat_no} ${newOrder.address.area} ${newOrder.address.address}`.trim(),
          address_2: newOrder.address.address_2,
          city: newOrder.address.city,
          state: newOrder.address.state,
          pincode: newOrder.address.pincode,
          country: newOrder.address.country,
        };
        const orderToInsert = {
          ...newOrder,
          address: {
            ...newOrder.address,
            shiprocket: shiprocketAddress
          }
        };
        const { error } = await supabase.from('quotes').insert([orderToInsert]);
        if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
        else {
          toast({ title: 'Order Created' });
          setNewOrder({ file_name: '', material: '', color: '', infill: 0, price: 0, user_id: '', address: { ...initialAddress } });
          // Refresh orders
          const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
          setOrders(data || []);
        }
      };

      // CRUD: Update Order
      const handleUpdateOrder = async (e) => {
        e.preventDefault();
        const { error } = await supabase.from('quotes').update(editingOrder).eq('id', editingOrder.id);
        if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
        else {
          toast({ title: 'Order Updated' });
          setEditingOrder(null);
          const { data } = await supabase.from('quotes').select('*').order('created_at', { ascending: false });
          setOrders(data || []);
        }
      };

      // CRUD: Delete Order
      const handleDeleteOrder = async (id) => {
        if (!window.confirm('Delete this order?')) return;
        // First, delete all cart_items referencing this quote
        await supabase.from('cart_items').delete().eq('quote_id', id);
        // Then, delete the quote itself
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
        else {
          toast({ title: 'Order Deleted' });
          setOrders((prev) => prev.filter((o) => o.id !== id));
        }
      };

      // Send Email to user via Aximake SMTP (order-status-email.php)
      const handleSendEmail = async (e) => {
        e.preventDefault();
        setSending(true);
        try {
          const response = await fetch(getPhpUrl('/order-status-email.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              to: emailForm.to,
              subject: emailForm.subject,
              message: emailForm.message,
              // Optionally, you can add a flag or type if needed for PHP
            }),
          });
          const text = await response.text();
          let result;
          try {
            result = JSON.parse(text);
          } catch {
            result = text;
          }
          if (!response.ok || (result && result.error)) {
            toast({
              title: 'Error',
              description: (result && result.error) ? result.error : (typeof result === 'string' ? result : 'Failed to send email'),
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Email Sent' });
            setEmailForm({ to: '', subject: '', message: '' });
          }
        } catch (err) {
          toast({ title: 'Error', description: err.message || 'Failed to send email', variant: 'destructive' });
        }
        setSending(false);
      };

      const handleToggleDetails = (orderId) => {
        setDetailsOpen(prev => ({ ...prev, [orderId]: !prev[orderId] }));
      };

      const handleStatusUpdate = async (orderId, newStatus) => {
        setStatusLoading(prev => ({ ...prev, [orderId]: true }));
        const { error } = await supabase.from('quotes').update({ order_status: newStatus }).eq('id', orderId);
        if (!error) setOrderStatuses(prev => ({ ...prev, [orderId]: newStatus }));
        setStatusLoading(prev => ({ ...prev, [orderId]: false }));
      };

      const handleSendStatusEmail = async (order, user) => {
        setStatusEmailLoading(prev => ({ ...prev, [order.id]: true }));
        try {
          const response = await fetch(getPhpUrl('/order-status-email.php'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              to: user.email,
              order_id: order.id,
              status: orderStatuses[order.id] || 'Pending',
            }),
          });
          const text = await response.text();
          let result;
          try {
            result = JSON.parse(text);
          } catch {
            result = text;
          }
          if (!response.ok || (result && result.error)) {
            toast({
              title: 'Error',
              description: (result && result.error) ? result.error : (typeof result === 'string' ? result : 'Failed to send status email'),
              variant: 'destructive',
            });
          } else {
            toast({ title: 'Status Email Sent' });
          }
        } catch (err) {
          toast({ title: 'Error', description: err.message || 'Failed to send status email', variant: 'destructive' });
        }
        setStatusEmailLoading(prev => ({ ...prev, [order.id]: false }));
      };

      const AnimatedCounter = ({ value, icon: Icon, label, color }) => {
        const props = useSpring({ val: value, from: { val: 0 }, config: { tension: 120, friction: 14 } });
        return (
          <div className="flex flex-col items-center justify-center bg-white rounded-full shadow-lg p-6 w-40 h-40 mx-2 my-4 border-2" style={{ borderColor: color }}>
            <Icon className="text-4xl mb-2" style={{ color }} />
            <animated.span className="text-3xl font-bold" style={{ color }}>
              {props.val.to(val => Math.floor(val))}
            </animated.span>
            <span className="text-base font-medium mt-1 text-gray-700 text-center">{label}</span>
          </div>
        );
      };

      // --- Dashboard Management Cards ---
      const managementModules = [
        {
          title: 'Customer Management',
          icon: <FaUsers className="text-4xl text-blue-500 mb-2" />,
          description: 'View, edit, and manage all customers.',
          route: '/admin/customers',
        },
        {
          title: 'Product Management',
          icon: <FaBoxOpen className="text-4xl text-green-500 mb-2" />,
          description: 'Add, update, or remove products from your store.',
          route: '/admin/products',
        },
        {
          title: 'Order Management',
          icon: <FaClipboardList className="text-4xl text-yellow-500 mb-2" />,
          description: 'Track, update, and fulfill customer orders.',
          route: '/admin/orders',
        },
        {
          title: 'Payment Management',
          icon: <span className="text-4xl text-purple-500 mb-2">💳</span>,
          description: 'Monitor and manage all payment transactions.',
          route: '/admin/payments',
        },
        {
          title: 'Discounts & Coupons',
          icon: <span className="text-4xl text-pink-500 mb-2">🏷️</span>,
          description: 'Create and manage discount codes and coupons.',
          route: '/admin/coupons',
        },
        {
          title: 'Store Settings',
          icon: <span className="text-4xl text-gray-500 mb-2">⚙️</span>,
          description: 'Configure store preferences and settings.',
          route: '/admin/settings',
        },
      ];

      const fetchLiveStatus = async (shipment_id, orderId) => {
        // Fetch live tracking info using the tracking endpoint (server provides detailed tracking at /api/shiprocket-tracking/:shipment_id)
        if (!shipment_id) return;
        setShiprocketStatusLoading(prev => ({ ...prev, [orderId]: true }));
        try {
          const res = await fetch(getApiUrl(`/api/shiprocket-tracking/${shipment_id}`));
          const data = await res.json();
          // server returns shipment_status / awb_code / track_url on success
          if (!data || data.error) {
            setLiveStatus(prev => ({ ...prev, [orderId]: null }));
          } else {
            setLiveStatus(prev => ({ ...prev, [orderId]: { status: data.shipment_status || data.status || null, track_url: data.track_url || data.track_url || null } }));
          }
        } catch (err) {
          setLiveStatus(prev => ({ ...prev, [orderId]: null }));
        }
        setShiprocketStatusLoading(prev => ({ ...prev, [orderId]: false }));
      };

      // Utility to fetch and update latest Shiprocket status after Ship action
      const fetchAndUpdateOrderStatus = async (order) => {
        if (!order.shiprocket_shipment_id) return;
        try {
          await fetch(getApiUrl(`/api/shiprocket-status`), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ shipment_id: order.shiprocket_shipment_id, order_code: order.order_code })
          });
          // Refetch orders to get updated status
          setLoading(true);
          const { data, error } = await supabase.from('orders').select('*, shiprocket_shipment_id, shiprocket_awb, shiprocket_status, shiprocket_label_url').order('created_at', { ascending: false });
          if (!error) setOrders(data || []);
          setLoading(false);
        } catch (e) {
          // Optionally show error
        }
      };

      if (!adminChecked) {
        return null; // Don't render anything until admin check is done
      }

      return (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.3 }}
          className="container mx-auto px-2 sm:px-4 lg:px-6 py-0"
        >
          <h1 className="text-4xl font-bold mb-8 gradient-text">Admin Panel</h1>
          <p className="text-lg text-muted-foreground mb-8">Manage orders and users. Send emails to users directly.</p>
          {/* Summary Section */}
          <div className="flex flex-wrap justify-center gap-4 mb-10">
            <AnimatedCounter value={users.length} icon={FaUsers} label="Total Users" color="#6366f1" />
            <AnimatedCounter value={orders.filter(o => (o.order_status || '').toLowerCase() === 'delivered').reduce((sum, o) => {
              // If items is an array, sum their quantities, else count as 1
              if (Array.isArray(o.items)) {
                return sum + o.items.reduce((s, item) => s + (item.quantity || 1), 0);
              }
              return sum + 1;
            }, 0)} icon={FaBoxOpen} label="Total Products Delivered" color="#22c55e" />
            <AnimatedCounter value={orders.reduce((sum, o) => {
              if (Array.isArray(o.items)) {
                return sum + o.items.reduce((s, item) => s + (item.quantity || 1), 0);
              }
              return sum + 1;
            }, 0)} icon={FaClipboardList} label="Total Products Ordered" color="#f59e42" />
            <AnimatedCounter value={orders.filter(o => o.order_status === 'Returned').reduce((sum, o) => {
              if (Array.isArray(o.items)) {
                return sum + o.items.reduce((s, item) => s + (item.quantity || 1), 0);
              }
              return sum + 1;
            }, 0)} icon={FaUndo} label="Total Returns" color="#ef4444" />
            <AnimatedCounter value={orders.filter(o => (o.order_status || '').toLowerCase() === 'cancelled').reduce((sum, o) => {
              if (Array.isArray(o.items)) {
                return sum + o.items.reduce((s, item) => s + (item.quantity || 1), 0);
              }
              return sum + 1;
            }, 0)} icon={FaTimesCircle} label="Total Cancelled" color="#ef4444" />
          </div>
          {/* Management Modules Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 my-10">
            {managementModules.map((mod) => (
              <motion.div
                key={mod.title}
                whileHover={{ scale: 1.05, boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}
                className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center cursor-pointer transition-all border border-gray-200 hover:border-primary"
                onClick={() => navigate(mod.route)}
              >
                {mod.icon}
                <h3 className="text-xl font-semibold mb-1 text-primary text-center">{mod.title}</h3>
                <p className="text-gray-600 text-center text-sm">{mod.description}</p>
                {/* Render custom content if available */}
                {mod.custom && (
                  <div className="mt-4 w-full">
                    {mod.custom}
                  </div>
                )}
              </motion.div>
            ))}
          </div>


          {/* Create Order */}
          <form onSubmit={handleCreateOrder} className="mb-8 space-y-2">
            <h3 className="text-xl font-semibold">Create New Order</h3>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="User ID" value={newOrder.user_id} onChange={e => setNewOrder({ ...newOrder, user_id: e.target.value })} required />
              <Input placeholder="File Name" value={newOrder.file_name} onChange={e => setNewOrder({ ...newOrder, file_name: e.target.value })} required />
              <Input placeholder="Material" value={newOrder.material} onChange={e => setNewOrder({ ...newOrder, material: e.target.value })} required />
              <Input placeholder="Color" value={newOrder.color} onChange={e => setNewOrder({ ...newOrder, color: e.target.value })} required />
              <Input placeholder="Infill" type="number" value={newOrder.infill} onChange={e => setNewOrder({ ...newOrder, infill: Number(e.target.value) })} required />
              <Input placeholder="Price" type="number" value={newOrder.price} onChange={e => setNewOrder({ ...newOrder, price: Number(e.target.value) })} required />
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              <Input placeholder="Recipient Name" value={newOrder.address.name} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, name: e.target.value } })} required />
              <Input placeholder="Recipient Email" value={newOrder.address.email} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, email: e.target.value } })} required />
              <Input placeholder="Phone" value={newOrder.address.phone} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, phone: e.target.value } })} required />
              <Input placeholder="Flat / House No." value={newOrder.address.flat_no} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, flat_no: e.target.value } })} required />
              <Input placeholder="Area / Street" value={newOrder.address.area} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, area: e.target.value } })} required />
              <Input placeholder="Full Address (optional)" value={newOrder.address.address} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, address: e.target.value } })} />
              <Input placeholder="Address Line 2 (optional)" value={newOrder.address.address_2} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, address_2: e.target.value } })} />
              <Input placeholder="City" value={newOrder.address.city} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, city: e.target.value } })} required />
              <Input placeholder="State" value={newOrder.address.state} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, state: e.target.value } })} required />
              <Input placeholder="Pincode" value={newOrder.address.pincode} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, pincode: e.target.value } })} required />
              <Input placeholder="Country" value={newOrder.address.country} onChange={e => setNewOrder({ ...newOrder, address: { ...newOrder.address, country: e.target.value } })} required />
            </div>
            <Button type="submit">Create</Button>
          </form>
          {/* Edit Order */}
          {editingOrder && (
            <form onSubmit={handleUpdateOrder} className="mb-8 space-y-2 bg-accent/10 p-4 rounded">
              <h3 className="text-xl font-semibold">Edit Order #{editingOrder.id}</h3>
              <div className="flex flex-wrap gap-2">
                <Input placeholder="File Name" value={editingOrder.file_name} onChange={e => setEditingOrder({ ...editingOrder, file_name: e.target.value })} required />
                <Input placeholder="Material" value={editingOrder.material} onChange={e => setEditingOrder({ ...editingOrder, material: e.target.value })} required />
                <Input placeholder="Color" value={editingOrder.color} onChange={e => setEditingOrder({ ...editingOrder, color: e.target.value })} required />
                <Input placeholder="Infill" type="number" value={editingOrder.infill} onChange={e => setEditingOrder({ ...editingOrder, infill: Number(e.target.value) })} required />
                <Input placeholder="Price" type="number" value={editingOrder.price} onChange={e => setEditingOrder({ ...editingOrder, price: Number(e.target.value) })} required />
                <Button type="submit">Save</Button>
                <Button type="button" variant="outline" onClick={() => setEditingOrder(null)}>Cancel</Button>
              </div>
            </form>
          )}
          {/* Users Table */}
          <h2 className="text-2xl font-semibold mb-4">All Users</h2>
          <div className="overflow-x-auto rounded-lg shadow-lg bg-white/80 dark:bg-card/80 mb-8">
            <table className="min-w-full divide-y divide-accent/30">
              <thead className="bg-gradient-to-r from-primary to-accent text-primary-foreground">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Email</th>
                  <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-accent/10">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-accent/10 transition">
                    <td className="px-4 py-3">{user.id}</td>
                    <td className="px-4 py-3">{user.email}</td>
                    <td className="px-4 py-3 text-xs">{new Date(user.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Send Email */}
          <form onSubmit={handleSendEmail} className="mb-8 space-y-2">
            <h3 className="text-xl font-semibold">Send Email to User</h3>
            <div className="flex flex-wrap gap-2">
              <Input placeholder="To (user email)" value={emailForm.to} onChange={e => setEmailForm({ ...emailForm, to: e.target.value })} required />
              <Input placeholder="Subject" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })} required />
              <Textarea placeholder="Message" value={emailForm.message} onChange={e => setEmailForm({ ...emailForm, message: e.target.value })} required />
              <Button type="submit" disabled={sending}>{sending ? 'Sending...' : 'Send Email'}</Button>
            </div>
          </form>
        </motion.div>
      );
    };

    export default AdminPanelPage;