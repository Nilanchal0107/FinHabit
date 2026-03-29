import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  where,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@services/firebase.js';
import { useAuthStore } from '@store/authStore.js';

/**
 * Generic Firestore hook for a user-scoped collection.
 * Path: users/{uid}/{collectionPath}
 *
 * @param {string} collectionPath - e.g. 'transactions', 'budgets'
 * @param {object} [queryOptions]
 * @param {string} [queryOptions.orderByField] - Field to order by
 * @param {'asc'|'desc'} [queryOptions.orderByDir] - Order direction
 * @param {number} [queryOptions.limitCount] - Max documents to fetch
 * @param {Array} [queryOptions.filters] - [{field, op, value}]
 * @param {boolean} [queryOptions.realtime] - Use onSnapshot if true
 */
export const useFirestore = (collectionPath, queryOptions = {}) => {
  const { user } = useAuthStore();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const {
    orderByField = 'createdAt',
    orderByDir = 'desc',
    limitCount,
    filters = [],
    realtime = false,
  } = queryOptions;

  const getCollectionRef = useCallback(() => {
    if (!user?.uid) return null;
    return collection(db, 'users', user.uid, collectionPath);
  }, [user?.uid, collectionPath]);

  const buildQuery = useCallback(
    (collRef) => {
      const constraints = [];
      filters.forEach(({ field, op, value }) => constraints.push(where(field, op, value)));
      if (orderByField) constraints.push(orderBy(orderByField, orderByDir));
      if (limitCount) constraints.push(limit(limitCount));
      return query(collRef, ...constraints);
    },
    [filters, orderByField, orderByDir, limitCount]
  );

  useEffect(() => {
    const collRef = getCollectionRef();
    if (!collRef) {
      setLoading(false);
      return;
    }

    const q = buildQuery(collRef);

    if (realtime) {
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        },
        (err) => {
          setError(err.message);
          setLoading(false);
        }
      );
      return unsubscribe;
    } else {
      getDocs(q)
        .then((snapshot) => {
          setData(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message);
          setLoading(false);
        });
    }
  }, [getCollectionRef, buildQuery, realtime]);

  const add = useCallback(
    async (docData) => {
      const collRef = getCollectionRef();
      if (!collRef) throw new Error('Not authenticated');
      const ref = await addDoc(collRef, { ...docData, createdAt: serverTimestamp() });
      return ref.id;
    },
    [getCollectionRef]
  );

  const set = useCallback(
    async (docId, docData, merge = true) => {
      const collRef = getCollectionRef();
      if (!collRef) throw new Error('Not authenticated');
      await setDoc(doc(collRef, docId), docData, { merge });
    },
    [getCollectionRef]
  );

  const update = useCallback(
    async (docId, updates) => {
      const collRef = getCollectionRef();
      if (!collRef) throw new Error('Not authenticated');
      await updateDoc(doc(collRef, docId), updates);
    },
    [getCollectionRef]
  );

  const remove = useCallback(
    async (docId) => {
      const collRef = getCollectionRef();
      if (!collRef) throw new Error('Not authenticated');
      await deleteDoc(doc(collRef, docId));
    },
    [getCollectionRef]
  );

  const getById = useCallback(
    async (docId) => {
      const collRef = getCollectionRef();
      if (!collRef) throw new Error('Not authenticated');
      const snap = await getDoc(doc(collRef, docId));
      return snap.exists() ? { id: snap.id, ...snap.data() } : null;
    },
    [getCollectionRef]
  );

  return { data, loading, error, add, set, update, remove, getById };
};
