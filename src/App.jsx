import { useState, useEffect, useRef } from 'react'
import GridView from './components/GridView'
import EditorView from './components/EditorView'
import { loadPosts, savePosts } from './utils/storage'

export default function App() {
  const [posts, setPosts] = useState(() => loadPosts() || [])
  const [view, setView] = useState('grid')
  const [editId, setEditId] = useState(null)
  const [previewFormat, setPreviewFormat] = useState('4x5')
  const [reverseOrder, setReverseOrder] = useState(false)
  const gridScrollY = useRef(0)

  useEffect(() => { savePosts(posts) }, [posts])

  const updatePost = (updated) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p))
  }

  const handleEditPost = (index) => {
    // index is into the full posts array (including blanks)
    setEditId(posts[index]?.id)
    setView('editor')
  }

  // Editor navigates among posts that have an imageUrl
  const realPosts = posts.filter(p => p.imageUrl || p.quote || p.saintName || p.author)
  const editIndex = realPosts.findIndex(p => p.id === editId)

  const handleNavigate = (newRealIndex) => {
    if (newRealIndex < 0 || newRealIndex >= realPosts.length) return
    setEditId(realPosts[newRealIndex].id)
  }

  const currentPost = posts.find(p => p.id === editId)

  if (view === 'editor' && currentPost) {
    return (
      <EditorView
        posts={realPosts}
        currentIndex={editIndex >= 0 ? editIndex : 0}
        onPostChange={updatePost}
        onNavigate={handleNavigate}
        onBackToGrid={() => setView('grid')}
      />
    )
  }

  return (
    <GridView
      posts={posts}
      onPostsChange={setPosts}
      onEditPost={handleEditPost}
      scrollY={gridScrollY.current}
      onScrollY={(y) => { gridScrollY.current = y }}
      previewFormat={previewFormat}
      onPreviewFormatChange={setPreviewFormat}
      reverseOrder={reverseOrder}
      onReverseOrderChange={setReverseOrder}
    />
  )
}
