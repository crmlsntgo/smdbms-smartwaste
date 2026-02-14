import initFirebase from '../firebaseConfig'
import { getFirestore, collection, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore'

export async function cleanupExpiredDeletedBins(){
  const app = initFirebase()
  const db = getFirestore(app)

  try {
    const now = Timestamp.now()
    const deletedCol = collection(db, 'deleted')

    const expiredQuery = query(deletedCol, where('autoDeleteAfter', '<=', now))
    const expiredSnapshot = await getDocs(expiredQuery)

    if (expiredSnapshot.empty) {
      console.log('No expired bins to delete')
      return { deleted: 0 }
    }

    const deletePromises = []
    let deleteCount = 0

    expiredSnapshot.forEach((docSnap) => {
      console.log(`Deleting expired bin: ${docSnap.id}`)
      deletePromises.push(deleteDoc(doc(db, 'deleted', docSnap.id)))
      deleteCount++
    })

    await Promise.all(deletePromises)
    console.log(`Successfully deleted ${deleteCount} expired bin(s)`)
    return { deleted: deleteCount }
  } catch (error) {
    console.error('Error cleaning up expired bins:', error)
    throw error
  }
}

export async function cleanupExpiredRestoredBins() {
  const app = initFirebase()
  const db = getFirestore(app)
  const EXPIRATION_MS = 60 * 1000 // 1 minute for testing
  // const EXPIRATION_MS = 24 * 60 * 60 * 1000 // 24 hours (Production)

  try {
     const archiveCol = collection(db, 'archive')
     const q = query(archiveCol, where('status', '==', 'Restored'))
     const snapshot = await getDocs(q)
     
     const deletePromises = []
     let deletedCount = 0
     const now = Date.now()

     snapshot.forEach(docSnap => {
         const data = docSnap.data()
         let restoredAtMs = 0
         
         if (data.restoredAt && typeof data.restoredAt.toMillis === 'function') {
             restoredAtMs = data.restoredAt.toMillis()
         } else if (data.restoredAt instanceof Date) {
             restoredAtMs = data.restoredAt.getTime()   
         } else {
             return // Skip invalid timestamp
         }

         if (now - restoredAtMs > EXPIRATION_MS) {
             console.log(`Deleting expired restored bin log: ${docSnap.id}`)
             deletePromises.push(deleteDoc(doc(db, 'archive', docSnap.id)))
             deletedCount++
         }
     })
     
     await Promise.all(deletePromises)
     return { deleted: deletedCount }

  } catch (e) {
      console.error("Error cleaning restored bins", e)
      return { deleted: 0 }
  }
}
