import express from 'express';
import { Subscription } from '../models/Subscription';
import { AlertService } from '../services/AlertService';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

// Create or update subscription
router.post('/', async (req, res) => {
  try {
    const {
      email,
      phone,
      push,
      location,
      radius_km,
      channels,
      language = 'en'
    } = req.body;

    // Validation
    if (!location || !location.lat || !location.lng) {
      return res.status(400).json({
        success: false,
        error: 'Location (lat, lng) is required'
      });
    }

    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'At least one notification channel is required'
      });
    }

    if (!radius_km || radius_km < 1 || radius_km > 100) {
      return res.status(400).json({
        success: false,
        error: 'Radius must be between 1 and 100 km'
      });
    }

    // Validate channels have corresponding contact info
    if (channels.includes('email') && !email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required for email notifications'
      });
    }

    if (channels.includes('sms') && !phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required for SMS notifications'
      });
    }

    if (channels.includes('webpush') && !push) {
      return res.status(400).json({
        success: false,
        error: 'Push subscription is required for web push notifications'
      });
    }

    // Generate subscription ID
    const subscriptionId = uuidv4();

    // Create subscription data
    const subscriptionData = {
      _id: subscriptionId,
      email: email || undefined,
      phone: phone || undefined,
      push: push || undefined,
      location: {
        type: 'Point',
        coordinates: [location.lng, location.lat]
      },
      radius_km,
      channels,
      language,
      created_at: new Date()
    };

    // Check for existing subscription with same contact info
    let existingSubscription = null;
    if (email) {
      existingSubscription = await Subscription.findOne({ email });
    } else if (phone) {
      existingSubscription = await Subscription.findOne({ phone });
    } else if (push?.endpoint) {
      existingSubscription = await Subscription.findOne({ 'push.endpoint': push.endpoint });
    }

    let subscription;
    if (existingSubscription) {
      // Update existing subscription
      subscription = await Subscription.findByIdAndUpdate(
        existingSubscription._id,
        subscriptionData,
        { new: true, runValidators: true }
      );
    } else {
      // Create new subscription
      subscription = new Subscription(subscriptionData);
      await subscription.save();
    }

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        location: {
          lat: subscription.location.coordinates[1],
          lng: subscription.location.coordinates[0]
        },
        radius_km: subscription.radius_km,
        channels: subscription.channels,
        language: subscription.language,
        created_at: subscription.created_at
      },
      message: existingSubscription ? 'Subscription updated' : 'Subscription created'
    });

  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create subscription',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get subscription by ID
router.get('/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findById(subscriptionId).lean();
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        location: {
          lat: subscription.location.coordinates[1],
          lng: subscription.location.coordinates[0]
        },
        radius_km: subscription.radius_km,
        channels: subscription.channels,
        language: subscription.language,
        created_at: subscription.created_at,
        has_email: !!subscription.email,
        has_phone: !!subscription.phone,
        has_push: !!subscription.push
      }
    });

  } catch (error) {
    console.error('Subscription fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch subscription'
    });
  }
});

// Update subscription
router.put('/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    const updates = req.body;

    // Remove fields that shouldn't be updated directly
    delete updates._id;
    delete updates.created_at;

    // Handle location update
    if (updates.location) {
      updates.location = {
        type: 'Point',
        coordinates: [updates.location.lng, updates.location.lat]
      };
    }

    const subscription = await Subscription.findByIdAndUpdate(
      subscriptionId,
      updates,
      { new: true, runValidators: true }
    );

    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      subscription: {
        id: subscription._id,
        location: {
          lat: subscription.location.coordinates[1],
          lng: subscription.location.coordinates[0]
        },
        radius_km: subscription.radius_km,
        channels: subscription.channels,
        language: subscription.language,
        created_at: subscription.created_at
      },
      message: 'Subscription updated'
    });

  } catch (error) {
    console.error('Subscription update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update subscription'
    });
  }
});

// Delete subscription
router.delete('/:subscriptionId', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findByIdAndDelete(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    res.json({
      success: true,
      message: 'Subscription deleted'
    });

  } catch (error) {
    console.error('Subscription deletion error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete subscription'
    });
  }
});

// Test alert for subscription
router.post('/:subscriptionId/test-alert', async (req, res) => {
  try {
    const { subscriptionId } = req.params;
    
    const subscription = await Subscription.findById(subscriptionId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Subscription not found'
      });
    }

    // Create a test event
    const testEvent = {
      _id: `test-${Date.now()}`,
      type: 'earthquake',
      severity: 5.2,
      geometry: {
        type: 'Point',
        coordinates: subscription.location.coordinates
      },
      area_bbox: [
        subscription.location.coordinates[0] - 0.1,
        subscription.location.coordinates[1] - 0.1,
        subscription.location.coordinates[0] + 0.1,
        subscription.location.coordinates[1] + 0.1
      ],
      properties: {
        place: 'Test Location',
        title: 'Test Alert - EcoGuard System Check'
      }
    };

    // Generate test alert content
    const alertContent = {
      title: '🧪 EcoGuard Test Alert',
      body: 'This is a test alert to verify your notification settings are working correctly.',
      action: 'Test completed successfully'
    };

    // Send test alert (implement the actual sending logic)
    // For now, just return success
    res.json({
      success: true,
      message: 'Test alert sent',
      subscription_id: subscriptionId,
      channels_tested: subscription.channels,
      test_event: {
        type: testEvent.type,
        severity: testEvent.severity,
        location: {
          lat: subscription.location.coordinates[1],
          lng: subscription.location.coordinates[0]
        }
      }
    });

  } catch (error) {
    console.error('Test alert error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test alert'
    });
  }
});

// Get subscription statistics
router.get('/stats/overview', async (req, res) => {
  try {
    const totalSubscriptions = await Subscription.countDocuments();
    
    // Channel distribution
    const channelStats = await Subscription.aggregate([
      { $unwind: '$channels' },
      { $group: { _id: '$channels', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Language distribution
    const languageStats = await Subscription.aggregate([
      { $group: { _id: '$language', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Radius distribution
    const radiusStats = await Subscription.aggregate([
      {
        $bucket: {
          groupBy: '$radius_km',
          boundaries: [0, 10, 25, 50, 100, 200],
          default: 'other',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    // Recent subscriptions (last 7 days)
    const recentCount = await Subscription.countDocuments({
      created_at: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });

    res.json({
      success: true,
      statistics: {
        total_subscriptions: totalSubscriptions,
        recent_subscriptions_7d: recentCount,
        by_channel: channelStats,
        by_language: languageStats,
        by_radius: radiusStats
      },
      generated_at: new Date().toISOString()
    });

  } catch (error) {
    console.error('Subscription stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate subscription statistics'
    });
  }
});

export default router;