import { useState, useEffect, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAppDispatch, useAppSelector } from '@/app/hooks'
import { addCustomer, setCustomers } from '@/features/customers/customersSlice'
import { addToast } from '@/features/ui/uiSlice'
import { getStorageItem, setStorageItem, STORAGE_KEYS } from '@/utils/localStorage'
import { validateIC, validatePhone, validateEmail } from '@/utils/validators'
import { formatIC } from '@/utils/formatters'
import { cn } from '@/lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '@/components/layout/PageWrapper'
import { Card, Button, Input, Select } from '@/components/common'
import {
  ArrowLeft,
  Save,
  User,
  CreditCard,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Briefcase,
  Upload,
  Camera,
  X,
  Check,
  AlertCircle,
  Image,
  FileText,
} from 'lucide-react'

export default function CustomerCreate() {
  const navigate = useNavigate()
  const dispatch = useAppDispatch()
  const [searchParams] = useSearchParams()
  const { customers } = useAppSelector((state) => state.customers)

  // File input refs
  const icFrontRef = useRef(null)
  const icBackRef = useRef(null)
  const profilePhotoRef = useRef(null)

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    icNumber: searchParams.get('ic') || '',
    phone: '',
    whatsapp: '',
    email: '',
    address: '',
    dateOfBirth: '',
    gender: '',
    occupation: '',
  })

  // Image states
  const [icFrontImage, setIcFrontImage] = useState(null)
  const [icBackImage, setIcBackImage] = useState(null)
  const [profilePhoto, setProfilePhoto] = useState(null)

  // Validation state
  const [errors, setErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sameAsPhone, setSameAsPhone] = useState(true)

  // Load customers on mount
  useEffect(() => {
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
    dispatch(setCustomers(storedCustomers))
  }, [dispatch])

  // Auto-fill WhatsApp when phone changes
  useEffect(() => {
    if (sameAsPhone) {
      setFormData(prev => ({ ...prev, whatsapp: prev.phone }))
    }
  }, [formData.phone, sameAsPhone])

  // Extract DOB from IC
  useEffect(() => {
    const ic = formData.icNumber.replace(/[-\s]/g, '')
    if (ic.length >= 6) {
      const year = ic.substring(0, 2)
      const month = ic.substring(2, 4)
      const day = ic.substring(4, 6)

      // Determine century (00-30 = 2000s, 31-99 = 1900s)
      const fullYear = parseInt(year) <= 30 ? `20${year}` : `19${year}`
      const dob = `${fullYear}-${month}-${day}`

      // Validate date
      const dateObj = new Date(dob)
      if (!isNaN(dateObj.getTime())) {
        setFormData(prev => ({ ...prev, dateOfBirth: dob }))
      }
    }
  }, [formData.icNumber])

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))

    // Clear error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }))
    }
  }

  // Handle blur for validation
  const handleBlur = (e) => {
    const { name } = e.target
    setTouched(prev => ({ ...prev, [name]: true }))
    validateField(name, formData[name])
  }

  // Validate single field
  const validateField = (name, value) => {
    let error = null

    switch (name) {
      case 'name':
        if (!value.trim()) error = 'Full name is required'
        else if (value.trim().length < 3) error = 'Name must be at least 3 characters'
        break
      case 'icNumber':
        const cleanIC = value.replace(/[-\s]/g, '')
        if (!cleanIC) error = 'IC number is required'
        else if (!validateIC(cleanIC)) error = 'Invalid IC format (12 digits required)'
        else {
          // Check for duplicate
          const exists = customers.find(c => c.icNumber.replace(/[-\s]/g, '') === cleanIC)
          if (exists) error = 'Customer with this IC already exists'
        }
        break
      case 'phone':
        if (!value.trim()) error = 'Phone number is required'
        else if (!validatePhone(value)) error = 'Invalid phone format'
        break
      case 'email':
        if (value && !validateEmail(value)) error = 'Invalid email format'
        break
      case 'address':
        if (!value.trim()) error = 'Address is required'
        break
    }

    setErrors(prev => ({ ...prev, [name]: error }))
    return !error
  }

  // Validate all fields
  const validateAll = () => {
    const fieldsToValidate = ['name', 'icNumber', 'phone', 'address']
    let isValid = true

    fieldsToValidate.forEach(field => {
      if (!validateField(field, formData[field])) {
        isValid = false
      }
      setTouched(prev => ({ ...prev, [field]: true }))
    })

    // Check IC images (KPKT requirement)
    if (!icFrontImage) {
      setErrors(prev => ({ ...prev, icFront: 'IC front image is required' }))
      isValid = false
    }
    if (!icBackImage) {
      setErrors(prev => ({ ...prev, icBack: 'IC back image is required' }))
      isValid = false
    }

    return isValid
  }

  // Handle image upload
  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      dispatch(addToast({
        type: 'error',
        title: 'Invalid File',
        message: 'Please upload an image file',
      }))
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      dispatch(addToast({
        type: 'error',
        title: 'File Too Large',
        message: 'Image must be less than 5MB',
      }))
      return
    }

    // Convert to base64
    const reader = new FileReader()
    reader.onloadend = () => {
      const base64 = reader.result

      switch (type) {
        case 'icFront':
          setIcFrontImage(base64)
          setErrors(prev => ({ ...prev, icFront: null }))
          break
        case 'icBack':
          setIcBackImage(base64)
          setErrors(prev => ({ ...prev, icBack: null }))
          break
        case 'profile':
          setProfilePhoto(base64)
          break
      }

      dispatch(addToast({
        type: 'success',
        title: 'Image Uploaded',
        message: `${type === 'icFront' ? 'IC Front' : type === 'icBack' ? 'IC Back' : 'Profile Photo'} uploaded successfully`,
      }))
    }
    reader.readAsDataURL(file)
  }

  // Remove image
  const removeImage = (type) => {
    switch (type) {
      case 'icFront':
        setIcFrontImage(null)
        if (icFrontRef.current) icFrontRef.current.value = ''
        break
      case 'icBack':
        setIcBackImage(null)
        if (icBackRef.current) icBackRef.current.value = ''
        break
      case 'profile':
        setProfilePhoto(null)
        if (profilePhotoRef.current) profilePhotoRef.current.value = ''
        break
    }
  }

  // Handle form submit
  const handleSubmit = (e) => {
    e.preventDefault()

    if (!validateAll()) {
      dispatch(addToast({
        type: 'error',
        title: 'Validation Error',
        message: 'Please fix the errors before submitting',
      }))
      return
    }

    setIsSubmitting(true)

    // Simulate save delay
    setTimeout(() => {
      // Generate customer ID
      const existingCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, [])
      const newId = `CUS${String(existingCustomers.length + 1).padStart(3, '0')}`

      // Create new customer object
      const newCustomer = {
        id: newId,
        name: formData.name.trim(),
        icNumber: formData.icNumber.replace(/[-\s]/g, ''),
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim() || formData.phone.trim(),
        email: formData.email.trim(),
        address: formData.address.trim(),
        dateOfBirth: formData.dateOfBirth,
        gender: formData.gender,
        occupation: formData.occupation.trim(),
        icFrontImage,
        icBackImage,
        profilePhoto,
        activePledges: 0,
        totalPledges: 0,
        totalAmount: 0,
        lastVisit: new Date().toISOString().split('T')[0],
        riskLevel: 'low',
        status: 'active',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      // Save to localStorage
      const updatedCustomers = [...existingCustomers, newCustomer]
      setStorageItem(STORAGE_KEYS.CUSTOMERS, updatedCustomers)
      dispatch(setCustomers(updatedCustomers))

      dispatch(addToast({
        type: 'success',
        title: 'Customer Created',
        message: `${newCustomer.name} has been added successfully`,
      }))

      setIsSubmitting(false)
      navigate(`/customers/${newId}`)
    }, 800)
  }

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <PageWrapper
      title="Add New Customer"
      subtitle="Register a new customer in the system"
      actions={
        <Button variant="outline" leftIcon={ArrowLeft} onClick={() => navigate('/customers')}>
          Back to List
        </Button>
      }
    >
      <form onSubmit={handleSubmit}>
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Main Form - Left Column */}
          <motion.div className="lg:col-span-2 space-y-6" variants={itemVariants}>
            {/* Personal Information */}
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Personal Information</h3>
                    <p className="text-sm text-zinc-500">Basic customer details</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Full Name */}
                  <div className="md:col-span-2">
                    <Input
                      label="Full Name (as per IC)"
                      name="name"
                      placeholder="Enter full name"
                      value={formData.name}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.name && errors.name}
                      required
                      leftIcon={User}
                    />
                  </div>

                  {/* IC Number */}
                  <div>
                    <Input
                      label="IC Number"
                      name="icNumber"
                      placeholder="XXXXXX-XX-XXXX"
                      value={formData.icNumber}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.icNumber && errors.icNumber}
                      required
                      leftIcon={CreditCard}
                    />
                    {formData.icNumber && !errors.icNumber && (
                      <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                        <Check className="w-3 h-3" />
                        Formatted: {formatIC(formData.icNumber)}
                      </p>
                    )}
                  </div>

                  {/* Date of Birth */}
                  <div>
                    <Input
                      label="Date of Birth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      leftIcon={Calendar}
                      hint="Auto-filled from IC"
                    />
                  </div>

                  {/* Gender */}
                  <div>
                    <Select
                      label="Gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      options={[
                        { value: '', label: 'Select Gender' },
                        { value: 'male', label: 'Male' },
                        { value: 'female', label: 'Female' },
                      ]}
                    />
                  </div>

                  {/* Occupation */}
                  <div>
                    <Input
                      label="Occupation"
                      name="occupation"
                      placeholder="Enter occupation"
                      value={formData.occupation}
                      onChange={handleChange}
                      leftIcon={Briefcase}
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* Contact Information */}
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                    <Phone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Contact Information</h3>
                    <p className="text-sm text-zinc-500">Phone, email, and address</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Phone */}
                  <div>
                    <Input
                      label="Phone Number"
                      name="phone"
                      placeholder="01X-XXX XXXX"
                      value={formData.phone}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.phone && errors.phone}
                      required
                      leftIcon={Phone}
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <Input
                      label="WhatsApp Number"
                      name="whatsapp"
                      placeholder="01X-XXX XXXX"
                      value={formData.whatsapp}
                      onChange={handleChange}
                      disabled={sameAsPhone}
                      leftIcon={Phone}
                    />
                    <label className="flex items-center gap-2 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={sameAsPhone}
                        onChange={(e) => setSameAsPhone(e.target.checked)}
                        className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500"
                      />
                      <span className="text-sm text-zinc-600">Same as phone number</span>
                    </label>
                  </div>

                  {/* Email */}
                  <div className="md:col-span-2">
                    <Input
                      label="Email Address"
                      name="email"
                      type="email"
                      placeholder="email@example.com"
                      value={formData.email}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.email && errors.email}
                      leftIcon={Mail}
                    />
                  </div>

                  {/* Address */}
                  <div className="md:col-span-2">
                    <Input
                      label="Full Address"
                      name="address"
                      placeholder="Enter full address"
                      value={formData.address}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.address && errors.address}
                      required
                      leftIcon={MapPin}
                      multiline
                    />
                  </div>
                </div>
              </div>
            </Card>

            {/* IC Copy Upload */}
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">IC Copy (KPKT Requirement)</h3>
                    <p className="text-sm text-zinc-500">Upload front and back of IC</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* IC Front */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      IC Front <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={icFrontRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'icFront')}
                      className="hidden"
                    />
                    <AnimatePresence mode="wait">
                      {icFrontImage ? (
                        <motion.div
                          key="preview"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative"
                        >
                          <img
                            src={icFrontImage}
                            alt="IC Front"
                            className="w-full h-40 object-cover rounded-lg border border-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage('icFront')}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-500 text-white text-xs rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Uploaded
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="upload"
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => icFrontRef.current?.click()}
                          className={cn(
                            'w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors',
                            errors.icFront
                              ? 'border-red-300 bg-red-50 text-red-500'
                              : 'border-zinc-300 hover:border-amber-500 hover:bg-amber-50 text-zinc-400 hover:text-amber-500'
                          )}
                        >
                          <Upload className="w-8 h-8" />
                          <span className="text-sm font-medium">Upload IC Front</span>
                          <span className="text-xs">Click or drag file here</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                    {errors.icFront && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.icFront}
                      </p>
                    )}
                  </div>

                  {/* IC Back */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      IC Back <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={icBackRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, 'icBack')}
                      className="hidden"
                    />
                    <AnimatePresence mode="wait">
                      {icBackImage ? (
                        <motion.div
                          key="preview"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          className="relative"
                        >
                          <img
                            src={icBackImage}
                            alt="IC Back"
                            className="w-full h-40 object-cover rounded-lg border border-zinc-200"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage('icBack')}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-500 text-white text-xs rounded-full flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Uploaded
                          </div>
                        </motion.div>
                      ) : (
                        <motion.button
                          key="upload"
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => icBackRef.current?.click()}
                          className={cn(
                            'w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors',
                            errors.icBack
                              ? 'border-red-300 bg-red-50 text-red-500'
                              : 'border-zinc-300 hover:border-amber-500 hover:bg-amber-50 text-zinc-400 hover:text-amber-500'
                          )}
                        >
                          <Upload className="w-8 h-8" />
                          <span className="text-sm font-medium">Upload IC Back</span>
                          <span className="text-xs">Click or drag file here</span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                    {errors.icBack && (
                      <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.icBack}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* Right Column - Profile Photo & Actions */}
          <motion.div className="space-y-6" variants={itemVariants}>
            {/* Profile Photo */}
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">Profile Photo</h3>
                    <p className="text-sm text-zinc-500">Optional</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <input
                  ref={profilePhotoRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, 'profile')}
                  className="hidden"
                />
                <AnimatePresence mode="wait">
                  {profilePhoto ? (
                    <motion.div
                      key="preview"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="relative"
                    >
                      <img
                        src={profilePhoto}
                        alt="Profile"
                        className="w-full aspect-square object-cover rounded-xl border border-zinc-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage('profile')}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="upload"
                      type="button"
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => profilePhotoRef.current?.click()}
                      className="w-full aspect-square border-2 border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-amber-500 hover:bg-amber-50 transition-colors text-zinc-400 hover:text-amber-500"
                    >
                      <div className="w-20 h-20 rounded-full bg-zinc-100 flex items-center justify-center">
                        <Image className="w-8 h-8" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-medium">Upload Photo</p>
                        <p className="text-xs">JPG, PNG up to 5MB</p>
                      </div>
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* Actions */}
            <Card className="p-5">
              <div className="space-y-3">
                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  fullWidth
                  leftIcon={Save}
                  loading={isSubmitting}
                >
                  {isSubmitting ? 'Saving...' : 'Save Customer'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => navigate('/customers')}
                >
                  Cancel
                </Button>
              </div>

              {/* Validation Summary */}
              {Object.keys(errors).some(key => errors[key]) && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg"
                >
                  <p className="text-sm font-medium text-red-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Please fix the following errors:
                  </p>
                  <ul className="mt-2 text-xs text-red-600 space-y-1">
                    {Object.keys(errors).map(key =>
                      errors[key] && (
                        <li key={key}>• {errors[key]}</li>
                      )
                    )}
                  </ul>
                </motion.div>
              )}
            </Card>

            {/* Tips */}
            <Card className="p-5 bg-amber-50 border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-2">💡 Tips</h4>
              <ul className="text-sm text-amber-700 space-y-1">
                <li>• IC copy is required by KPKT regulations</li>
                <li>• Date of birth is auto-filled from IC</li>
                <li>• WhatsApp is used for sending receipts</li>
              </ul>
            </Card>
          </motion.div>
        </motion.div>
      </form>
    </PageWrapper>
  )
}