'use strict';
/** 领域层共用工具：计数、用户信息脱敏、分页、JSON 字段水合。 */

const { get, all } = require('../data/db');
const { parseJSON } = require('../lib/util');

function countBy(table, whereSql, params = []) {
  const row = get(`SELECT COUNT(*) AS c FROM ${table} ${whereSql}`, params);
  return row ? Number(row.c) : 0;
}

function likeCount(targetType, targetId) {
  return countBy('reactions', 'WHERE target_type = ? AND target_id = ? AND type = ?', [targetType, targetId, 'like']);
}

function favCount(targetType, targetId) {
  return countBy('reactions', 'WHERE target_type = ? AND target_id = ? AND type = ?', [targetType, targetId, 'fav']);
}

function commentCount(targetType, targetId) {
  return countBy('comments', 'WHERE target_type = ? AND target_id = ? AND status = ?', [targetType, targetId, 'published']);
}

function myReaction(userId, targetType, targetId, type) {
  if (!userId) return 0;
  const row = get(
    'SELECT id FROM reactions WHERE user_id = ? AND target_type = ? AND target_id = ? AND type = ?',
    [userId, targetType, targetId, type]
  );
  return row ? 1 : 0;
}

function attachInteraction(row, targetType, targetIdKey, userId) {
  const targetId = row[targetIdKey] || row.id;
  return {
    ...row,
    like_count: likeCount(targetType, targetId),
    fav_count: favCount(targetType, targetId),
    comment_count: commentCount(targetType, targetId),
    liked: myReaction(userId, targetType, targetId, 'like'),
    faved: myReaction(userId, targetType, targetId, 'fav')
  };
}

function publicUser(row) {
  if (!row) return null;
  const { password_hash, password_salt, ...rest } = row;
  return {
    ...rest,
    platforms: parseJSON(row.platforms, [])
  };
}

function hydratePlatform(row) {
  if (!row) return null;
  return {
    ...row,
    features: parseJSON(row.features, []),
    redlines: parseJSON(row.redlines, []),
    official_links: parseJSON(row.official_links, []),
    tags: parseJSON(row.tags, [])
  };
}

function hydrateTool(row) {
  if (!row) return null;
  return { ...row, tags: parseJSON(row.tags, []) };
}

function hydratePost(row) {
  if (!row) return null;
  return { ...row, tags: parseJSON(row.tags, []) };
}

function buildPage(total, pageNum, pageSize) {
  return {
    total,
    page: pageNum,
    page_size: pageSize,
    total_pages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function offset(pageNum, pageSize) {
  return (pageNum - 1) * pageSize;
}

module.exports = {
  countBy, likeCount, favCount, commentCount, myReaction, attachInteraction,
  publicUser, hydratePlatform, hydrateTool, hydratePost, buildPage, offset
};
