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

export const useSubscription = () => {
  const { token, user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSubscriptionData = async () => {
      if (!token) return;

      try {
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
          // Default to free plan if no subscription found
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
          // Default usage data
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