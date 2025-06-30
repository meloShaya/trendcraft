import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface Subscription {
  id: string;
  plan: 'free' | 'pro';
  status: 'active' | 'canceled' | 'past_due';
  current_period_end: string;
}

interface UsageData {
  posts_generated: number;
  images_generated: number;
  videos_generated: number;
  month: string;
}

// Demo data for local memory mode
const DEMO_SUBSCRIPTION: Subscription = {
  id: 'demo-sub-123',
  plan: 'pro',
  status: 'active',
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days from now
};

const DEMO_USAGE: UsageData = {
  posts_generated: 25,
  images_generated: 8,
  videos_generated: 3,
  month: new Date().toISOString().slice(0, 7)
};

const USE_LOCAL_MEMORY = true; // Match the auth context setting

export const useSubscription = () => {
  const { token, user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!token) return;

      try {
        // Local memory mode - use demo data
        if (USE_LOCAL_MEMORY) {
          console.log('🔄 [SUBSCRIPTION] Using demo subscription data');
          setSubscription(DEMO_SUBSCRIPTION);
          setUsage(DEMO_USAGE);
          setLoading(false);
          return;
        }

        // Original API calls (kept intact)
        const [subResponse, usageResponse] = await Promise.all([
          fetch('/api/subscription', {
            headers: { Authorization: `Bearer ${token}` }
          }),
          fetch('/api/usage', {
            headers: { Authorization: `Bearer ${token}` }
          })
        ]);

        if (subResponse.ok) {
          const subData = await subResponse.json();
          setSubscription(subData);
        } else {
          setSubscription({
            id: 'free',
            plan: 'free',
            status: 'active',
            current_period_end: ''
          });
        }

        if (usageResponse.ok) {
          const usageData = await usageResponse.json();
          setUsage(usageData);
        } else {
          setUsage({
            posts_generated: 0,
            images_generated: 0,
            videos_generated: 0,
            month: new Date().toISOString().slice(0, 7)
          });
        }
      } catch (error) {
        console.error('Error fetching subscription data:', error);
        // Set defaults on error
        setSubscription({
          id: 'free',
          plan: 'free',
          status: 'active',
          current_period_end: ''
        });
        setUsage({
          posts_generated: 0,
          images_generated: 0,
          videos_generated: 0,
          month: new Date().toISOString().slice(0, 7)
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionData();
  }, [token]);

  const isPremium = subscription?.plan === 'pro' && subscription?.status === 'active';

  const canGeneratePost = () => {
    if (isPremium) return true;
    return (usage?.posts_generated || 0) < 10;
  };

  const canGenerateImage = () => {
    return isPremium;
  };

  const canGenerateVideo = () => {
    return isPremium;
  };

  const createCheckoutSession = async (plan: 'pro') => {
    try {
      // Local memory mode - simulate checkout
      if (USE_LOCAL_MEMORY) {
        console.log('🔄 [SUBSCRIPTION] Demo checkout for plan:', plan);
        alert('Demo Mode: In a real app, this would redirect to Stripe checkout. For demo purposes, you already have Pro features!');
        return;
      }

      // Original checkout logic (kept intact)
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ plan })
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error creating checkout session:', error);
      throw error;
    }
  };

  const openBillingPortal = async () => {
    try {
      // Local memory mode - simulate billing portal
      if (USE_LOCAL_MEMORY) {
        console.log('🔄 [SUBSCRIPTION] Demo billing portal');
        alert('Demo Mode: In a real app, this would open the Stripe billing portal.');
        return;
      }

      // Original billing portal logic (kept intact)
      const response = await fetch('/api/billing-portal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to open billing portal');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Error opening billing portal:', error);
      throw error;
    }
  };

  return {
    subscription,
    usage,
    loading,
    isPremium,
    canGeneratePost,
    canGenerateImage,
    canGenerateVideo,
    createCheckoutSession,
    openBillingPortal
  };
};