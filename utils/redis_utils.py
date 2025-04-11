"""
Redis utility functions for session management and caching
"""

import redis
from flask import current_app
import json
from datetime import datetime, timedelta
import logging


def get_redis_client():
    """
    Get a Redis client instance from the Flask application configuration
    """
    try:
        from run import redis_client
        return redis_client
    except ImportError:
        # Fallback to config-based connection
        redis_url = current_app.config.get('SESSION_REDIS', 'redis://:MinosProject1234@10.20.52.20:6379/0')
        if isinstance(redis_url, str):
            return redis.from_url(redis_url)
        # If SESSION_REDIS is already a Redis instance
        return redis_url


def cache_data(key, data, expiry_seconds=3600):
    """
    Cache data in Redis with expiration
    
    Args:
        key (str): Redis key
        data (any): Data to cache (will be JSON serialized)
        expiry_seconds (int): Time to live in seconds
        
    Returns:
        bool: Success status
    """
    try:
        redis_client = get_redis_client()
        serialized_data = json.dumps(data)
        redis_client.setex(key, expiry_seconds, serialized_data)
        return True
    except Exception as e:
        logging.error(f"Redis caching error: {e}")
        return False


def get_cached_data(key, default=None):
    """
    Retrieve cached data from Redis
    
    Args:
        key (str): Redis key
        default (any): Default value if key not found
        
    Returns:
        any: Retrieved data or default
    """
    try:
        redis_client = get_redis_client()
        data = redis_client.get(key)
        if data:
            return json.loads(data)
        return default
    except Exception as e:
        logging.error(f"Redis retrieval error: {e}")
        return default


def delete_cached_data(key_or_pattern, is_pattern=False):
    """
    Delete cached data from Redis
    
    Args:
        key_or_pattern (str): Redis key or pattern
        is_pattern (bool): Whether to use pattern matching
        
    Returns:
        int: Number of keys deleted
    """
    try:
        redis_client = get_redis_client()
        if is_pattern:
            keys = redis_client.keys(key_or_pattern)
            if keys:
                return redis_client.delete(*keys)
            return 0
        else:
            return redis_client.delete(key_or_pattern)
    except Exception as e:
        logging.error(f"Redis deletion error: {e}")
        return 0


def update_session_activity(session_id):
    """
    Update the last activity timestamp for a session
    
    Args:
        session_id (str): Session ID to update
        
    Returns:
        bool: Success status
    """
    try:
        redis_client = get_redis_client()
        key = f"minos_session:{session_id}:activity"
        redis_client.set(key, datetime.utcnow().isoformat())
        # Set TTL to match session lifetime
        session_lifetime = current_app.config.get('PERMANENT_SESSION_LIFETIME', timedelta(hours=1))
        if isinstance(session_lifetime, timedelta):
            redis_client.expire(key, int(session_lifetime.total_seconds()))
        return True
    except Exception as e:
        logging.error(f"Redis session activity update error: {e}")
        return False


def get_active_sessions_count():
    """
    Get count of currently active sessions
    
    Returns:
        int: Number of active sessions
    """
    try:
        redis_client = get_redis_client()
        return len(redis_client.keys("minos_session:*"))
    except Exception as e:
        logging.error(f"Redis active sessions count error: {e}")
        return 0


def invalidate_user_sessions(user_id):
    """
    Invalidate all sessions for a specific user
    
    Args:
        user_id (str): User ID to invalidate sessions for
        
    Returns:
        int: Number of sessions invalidated
    """
    try:
        redis_client = get_redis_client()
        # Pattern to match all sessions for this user
        pattern = f"minos_session:*"
        session_keys = redis_client.keys(pattern)
        
        count = 0
        for key in session_keys:
            session_data = redis_client.get(key)
            if session_data:
                try:
                    data = json.loads(session_data)
                    if data.get('user_id') == str(user_id):
                        redis_client.delete(key)
                        count += 1
                except json.JSONDecodeError:
                    pass
                    
        return count
    except Exception as e:
        logging.error(f"Redis user sessions invalidation error: {e}")
        return 0 