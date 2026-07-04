// طبقة التوافق — تُصدِّر auth الموحَّدة من نظام مصادقة المتجر
export {
  storeHandlers as handlers,
  storeAuth     as auth,
  storeSignIn   as signIn,
  storeSignOut  as signOut,
} from './auth-store'