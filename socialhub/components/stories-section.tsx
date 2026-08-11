import React from 'react';
import { ScrollView, StyleSheet, View, Image } from 'react-native';
import { Text } from 'react-native-paper';

const STORIES = [
  { id: 'add', name: 'Add Story', isAdd: true },
  { id: '1', name: 'Adeel', avatar: 'https://i.pravatar.cc/150?u=adeel' },
  { id: '2', name: 'Sara', avatar: 'https://i.pravatar.cc/150?u=sara' },
  { id: '3', name: 'Ali', avatar: 'https://i.pravatar.cc/150?u=ali' },
  { id: '4', name: 'Zara', avatar: 'https://i.pravatar.cc/150?u=zara' },
  { id: '5', name: 'Hassan', avatar: 'https://i.pravatar.cc/150?u=hassan' },
  { id: '6', name: 'Nida', avatar: 'https://i.pravatar.cc/150?u=nida' },
  { id: '7', name: 'Bilal', avatar: 'https://i.pravatar.cc/150?u=bilal' },
  { id: '8', name: 'Ayesha', avatar: 'https://i.pravatar.cc/150?u=ayesha' },
];

export function StoriesSection() {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}>
        {STORIES.map((story) => (
          <View key={story.id} style={styles.storyItem}>
            <View style={[styles.avatarContainer, story.isAdd && styles.addContainer]}>
              {story.isAdd ? (
                <Text style={styles.addIcon}>+</Text>
              ) : (
                <View style={styles.ring}>
                  <Image source={{ uri: story.avatar }} style={styles.avatar} />
                </View>
              )}
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {story.name}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 16,
  },
  storyItem: {
    alignItems: 'center',
    width: 72,
  },
  avatarContainer: {
    width: 68,
    height: 68,
    borderRadius: 34,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  addContainer: {
    backgroundColor: '#EDE9FE',
    borderWidth: 2,
    borderColor: '#7C3AED',
    borderStyle: 'dashed',
  },
  addIcon: {
    fontSize: 28,
    fontWeight: '600',
    color: '#7C3AED',
  },
  ring: {
    width: 70,
    height: 70,
    borderRadius: 35,
    padding: 3,
    backgroundColor: 'transparent',
    borderWidth: 3,
    borderColor: '#7C3AED',
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
  },
  name: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1E293B',
    marginTop: 6,
    textAlign: 'center',
  },
});
