import api from './api.js';

export const noteService = {
  // Get all notes with filters (scope, view, collection, tag, search, sort)
  getNotes: async (params = {}) => {
    const response = await api.get('/notes', { params });
    return response.data;
  },

  // Get single note by ID
  getNoteById: async (id) => {
    const response = await api.get(`/notes/${id}`);
    return response.data;
  },

  // Create new note
  createNote: async (data) => {
    const response = await api.post('/notes', data);
    return response.data;
  },

  // Update note (title, content, tags, collection, pin, favorite)
  updateNote: async (id, data) => {
    const response = await api.put(`/notes/${id}`, data);
    return response.data;
  },

  // Archive note
  archiveNote: async (id) => {
    const response = await api.patch(`/notes/${id}/archive`);
    return response.data;
  },

  // Restore note (from archive or trash)
  restoreNote: async (id) => {
    const response = await api.patch(`/notes/${id}/restore`);
    return response.data;
  },

  // Move note to Trash
  trashNote: async (id) => {
    const response = await api.patch(`/notes/${id}/trash`);
    return response.data;
  },

  // Permanently delete note
  deleteNotePermanently: async (id) => {
    const response = await api.delete(`/notes/${id}`);
    return response.data;
  },

  // Empty all notes in Trash
  emptyTrash: async (params = {}) => {
    const response = await api.delete('/notes/trash/empty', { params });
    return response.data;
  },

  // Link existing task to note
  linkTask: async (noteId, taskId) => {
    const response = await api.post(`/notes/${noteId}/link-task`, { taskId });
    return response.data;
  },

  // Unlink task from note
  unlinkTask: async (noteId, taskId) => {
    const response = await api.post(`/notes/${noteId}/unlink-task`, { taskId });
    return response.data;
  },

  // Create task from selected text
  createTaskFromSelection: async (noteId, taskData) => {
    const response = await api.post(`/notes/${noteId}/create-task-from-selection`, taskData);
    return response.data;
  },

  // Collections
  getCollections: async (params = {}) => {
    const response = await api.get('/note-collections', { params });
    return response.data;
  },

  createCollection: async (data) => {
    const response = await api.post('/note-collections', data);
    return response.data;
  },

  updateCollection: async (id, data) => {
    const response = await api.put(`/note-collections/${id}`, data);
    return response.data;
  },

  deleteCollection: async (id) => {
    const response = await api.delete(`/note-collections/${id}`);
    return response.data;
  },
};

export default noteService;
