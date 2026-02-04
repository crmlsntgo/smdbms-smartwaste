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
