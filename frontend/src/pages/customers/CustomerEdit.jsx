import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  updateCustomer,
  setCustomers,
} from "@/features/customers/customersSlice";
import { addToast } from "@/features/ui/uiSlice";
import { customerService } from "@/services";
import { getStorageUrl } from "@/utils/helpers";
import { validateIC, validatePhone, validateEmail } from "@/utils/validators";
import { formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select } from "@/components/common";
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
  Loader2,
  RotateCcw,
} from "lucide-react";

// Malaysian states
const malaysianStates = [
  "Johor",
  "Kedah",
  "Kelantan",
  "Melaka",
  "Negeri Sembilan",
  "Pahang",
  "Perak",
  "Perlis",
  "Pulau Pinang",
  "Sabah",
  "Sarawak",
  "Selangor",
  "Terengganu",
  "Kuala Lumpur",
  "Labuan",
  "Putrajaya",
];

// Nationality options
const nationalityOptions = [
  "Malaysian",
  "Singaporean",
  "Indonesian",
  "Thai",
  "Filipino",
  "Vietnamese",
  "Indian",
  "Chinese",
  "Bangladeshi",
  "Myanmar",
  "Other",
];

export default function CustomerEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { customers } = useAppSelector((state) => state.customers);

  // File input refs
  const icFrontRef = useRef(null);
  const icBackRef = useRef(null);
  const profilePhotoRef = useRef(null);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [originalCustomer, setOriginalCustomer] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    icNumber: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    nationality: "Malaysian",
    dateOfBirth: "",
    gender: "",
    occupation: "",
  });

  // Image states - for preview (base64 or URL)
  const [icFrontImage, setIcFrontImage] = useState(null);
  const [icBackImage, setIcBackImage] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);

  // File states - for upload (File objects)
  const [icFrontFile, setIcFrontFile] = useState(null);
  const [icBackFile, setIcBackFile] = useState(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);

  // Track if images changed
  const [imagesChanged, setImagesChanged] = useState({
    icFront: false,
    icBack: false,
    profile: false,
  });

  // Validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsPhone, setSameAsPhone] = useState(false);

  // Fetch customer data
  useEffect(() => {
    const fetchCustomer = async () => {
      try {
        setIsLoading(true);
        const response = await customerService.getById(id);
        const customer = response.data || response;

        setOriginalCustomer(customer);

        // Populate form data
        setFormData({
          name: customer.name || "",
          icNumber: customer.ic_number || "",
          phone: customer.phone || "",
          whatsapp: customer.phone_alt || customer.phone || "",
          email: customer.email || "",
          address: customer.address_line1 || "",
          city: customer.city || "",
          state: customer.state || "",
          postcode: customer.postcode || "",
          nationality: customer.nationality || "Malaysian",
          dateOfBirth: customer.date_of_birth
            ? customer.date_of_birth.split("T")[0]
            : "",
          gender: customer.gender || "",
          occupation: customer.occupation || "",
        });

        // Set existing images (use storage URL)
        if (customer.ic_front_photo) {
          setIcFrontImage(getStorageUrl(customer.ic_front_photo));
        }
        if (customer.ic_back_photo) {
          setIcBackImage(getStorageUrl(customer.ic_back_photo));
        }
        if (customer.selfie_photo) {
          setProfilePhoto(getStorageUrl(customer.selfie_photo));
        }

        // Check if whatsapp is same as phone
        setSameAsPhone(
          customer.phone === (customer.phone_alt || customer.phone)
        );
      } catch (error) {
        console.error("Error fetching customer:", error);
        dispatch(
          addToast({
            type: "error",
            title: "Error",
            message: "Failed to load customer",
          })
        );
        navigate("/customers");
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchCustomer();
    }
  }, [id, dispatch, navigate]);

  // Auto-fill WhatsApp when phone changes
  useEffect(() => {
    if (sameAsPhone) {
      setFormData((prev) => ({ ...prev, whatsapp: prev.phone }));
    }
  }, [formData.phone, sameAsPhone]);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
  };

  // Handle blur for validation
  const handleBlur = (e) => {
    const { name } = e.target;
    setTouched((prev) => ({ ...prev, [name]: true }));
    validateField(name, formData[name]);
  };

  // Validate single field
  const validateField = (name, value) => {
    let error = null;

    switch (name) {
      case "name":
        if (!value.trim()) error = "Full name is required";
        else if (value.trim().length < 3)
          error = "Name must be at least 3 characters";
        break;
      case "icNumber":
        const cleanIC = value.replace(/[-\s]/g, "");
        if (!cleanIC) error = "IC number is required";
        else if (!validateIC(cleanIC))
          error = "Invalid IC format (12 digits required)";
        break;
      case "phone":
        if (!value.trim()) error = "Phone number is required";
        else if (!validatePhone(value)) error = "Invalid phone format";
        break;
      case "email":
        if (value && !validateEmail(value)) error = "Invalid email format";
        break;
      case "address":
        if (!value.trim()) error = "Address is required";
        break;
    }

    setErrors((prev) => ({ ...prev, [name]: error }));
    return !error;
  };

  // Validate all fields
  const validateAll = () => {
    const fieldsToValidate = ["name", "icNumber", "phone", "address"];
    let isValid = true;

    fieldsToValidate.forEach((field) => {
      if (!validateField(field, formData[field])) {
        isValid = false;
      }
      setTouched((prev) => ({ ...prev, [field]: true }));
    });

    return isValid;
  };

  // Handle image upload
  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      dispatch(
        addToast({
          type: "error",
          title: "Invalid File",
          message: "Please upload an image file",
        })
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      dispatch(
        addToast({
          type: "error",
          title: "File Too Large",
          message: "Image must be less than 5MB",
        })
      );
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;

      switch (type) {
        case "icFront":
          setIcFrontImage(base64);
          setIcFrontFile(file);
          setImagesChanged((prev) => ({ ...prev, icFront: true }));
          break;
        case "icBack":
          setIcBackImage(base64);
          setIcBackFile(file);
          setImagesChanged((prev) => ({ ...prev, icBack: true }));
          break;
        case "profile":
          setProfilePhoto(base64);
          setProfilePhotoFile(file);
          setImagesChanged((prev) => ({ ...prev, profile: true }));
          break;
      }

      dispatch(
        addToast({
          type: "success",
          title: "Image Updated",
          message: `${
            type === "icFront"
              ? "IC Front"
              : type === "icBack"
              ? "IC Back"
              : "Profile Photo"
          } updated`,
        })
      );
    };
    reader.readAsDataURL(file);
  };

  // Remove image
  const removeImage = (type) => {
    switch (type) {
      case "icFront":
        setIcFrontImage(null);
        setIcFrontFile(null);
        setImagesChanged((prev) => ({ ...prev, icFront: true }));
        if (icFrontRef.current) icFrontRef.current.value = "";
        break;
      case "icBack":
        setIcBackImage(null);
        setIcBackFile(null);
        setImagesChanged((prev) => ({ ...prev, icBack: true }));
        if (icBackRef.current) icBackRef.current.value = "";
        break;
      case "profile":
        setProfilePhoto(null);
        setProfilePhotoFile(null);
        setImagesChanged((prev) => ({ ...prev, profile: true }));
        if (profilePhotoRef.current) profilePhotoRef.current.value = "";
        break;
    }
  };

  // Reset to original
  const handleReset = () => {
    if (!originalCustomer) return;

    setFormData({
      name: originalCustomer.name || "",
      icNumber: originalCustomer.ic_number || "",
      phone: originalCustomer.phone || "",
      whatsapp: originalCustomer.phone_alt || originalCustomer.phone || "",
      email: originalCustomer.email || "",
      address: originalCustomer.address_line1 || "",
      city: originalCustomer.city || "",
      state: originalCustomer.state || "",
      postcode: originalCustomer.postcode || "",
      nationality: originalCustomer.nationality || "Malaysian",
      dateOfBirth: originalCustomer.date_of_birth
        ? originalCustomer.date_of_birth.split("T")[0]
        : "",
      gender: originalCustomer.gender || "",
      occupation: originalCustomer.occupation || "",
    });

    // Reset images to original
    setIcFrontImage(
      originalCustomer.ic_front_photo
        ? getStorageUrl(originalCustomer.ic_front_photo)
        : null
    );
    setIcBackImage(
      originalCustomer.ic_back_photo
        ? getStorageUrl(originalCustomer.ic_back_photo)
        : null
    );
    setProfilePhoto(
      originalCustomer.selfie_photo
        ? getStorageUrl(originalCustomer.selfie_photo)
        : null
    );

    // Clear file objects
    setIcFrontFile(null);
    setIcBackFile(null);
    setProfilePhotoFile(null);
    setImagesChanged({ icFront: false, icBack: false, profile: false });

    setErrors({});
    setTouched({});

    dispatch(
      addToast({
        type: "info",
        title: "Reset",
        message: "Form reset to original values",
      })
    );
  };

  // Handle form submit
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateAll()) {
      dispatch(
        addToast({
          type: "error",
          title: "Validation Error",
          message: "Please fix the errors before submitting",
        })
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const customerData = {
        name: formData.name.trim(),
        ic_number: formData.icNumber.replace(/[-\s]/g, ""),
        ic_type: "mykad",
        phone: formData.phone.trim(),
        whatsapp: formData.whatsapp.trim() || formData.phone.trim(),
        email: formData.email.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim() || null,
        state: formData.state || null,
        postcode: formData.postcode.trim() || null,
        nationality: formData.nationality || "Malaysian",
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        occupation: formData.occupation.trim() || null,
      };

      // Only add files if they were changed
      if (imagesChanged.icFront && icFrontFile) {
        customerData.ic_front_image = icFrontFile;
      }
      if (imagesChanged.icBack && icBackFile) {
        customerData.ic_back_image = icBackFile;
      }
      if (imagesChanged.profile && profilePhotoFile) {
        customerData.profile_photo = profilePhotoFile;
      }

      const response = await customerService.update(id, customerData);
      const updatedCustomer = response.data || response;

      dispatch(updateCustomer(updatedCustomer));
      dispatch(
        addToast({
          type: "success",
          title: "Customer Updated",
          message: `${formData.name} has been updated successfully`,
        })
      );

      navigate(`/customers/${id}`);
    } catch (error) {
      console.error("Error updating customer:", error);

      if (error.response?.data?.errors) {
        const apiErrors = error.response.data.errors;
        const formattedErrors = {};
        Object.keys(apiErrors).forEach((key) => {
          const fieldMap = {
            ic_number: "icNumber",
            date_of_birth: "dateOfBirth",
          };
          const formField = fieldMap[key] || key;
          formattedErrors[formField] = apiErrors[key][0];
        });
        setErrors(formattedErrors);
      }

      dispatch(
        addToast({
          type: "error",
          title: "Error",
          message: error.response?.data?.message || "Failed to update customer",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  // Loading state
  if (isLoading) {
    return (
      <PageWrapper title="Edit Customer">
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <p className="text-zinc-500">Loading customer...</p>
          </div>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      title="Edit Customer"
      subtitle={`Editing: ${originalCustomer?.name || ""}`}
      actions={
        <Button
          variant="outline"
          leftIcon={ArrowLeft}
          onClick={() => navigate(`/customers/${id}`)}
        >
          Back to Details
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
          <motion.div
            className="lg:col-span-2 space-y-6"
            variants={itemVariants}
          >
            {/* Personal Information */}
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                    <User className="w-5 h-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">
                      Personal Information
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Basic customer details
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  <div>
                    <Input
                      label="Date of Birth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleChange}
                      leftIcon={Calendar}
                    />
                  </div>

                  <div>
                    <Select
                      label="Gender"
                      name="gender"
                      value={formData.gender}
                      onChange={handleChange}
                      options={[
                        { value: "", label: "Select Gender" },
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
                      ]}
                    />
                  </div>

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
                    <h3 className="font-semibold text-zinc-800">
                      Contact Information
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Phone, email, and address
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                      <span className="text-sm text-zinc-600">
                        Same as phone number
                      </span>
                    </label>
                  </div>

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

                  <div className="md:col-span-2">
                    <Input
                      label="Full Address"
                      name="address"
                      placeholder="Street address, building name, etc."
                      value={formData.address}
                      onChange={handleChange}
                      onBlur={handleBlur}
                      error={touched.address && errors.address}
                      required
                      leftIcon={MapPin}
                      multiline
                    />
                  </div>

                  <div>
                    <Input
                      label="City"
                      name="city"
                      placeholder="Enter city"
                      value={formData.city}
                      onChange={handleChange}
                    />
                  </div>

                  <div>
                    <Input
                      label="Postcode"
                      name="postcode"
                      placeholder="e.g., 50000"
                      value={formData.postcode}
                      onChange={handleChange}
                      maxLength={5}
                    />
                  </div>

                  <div>
                    <Select
                      label="State"
                      name="state"
                      value={formData.state}
                      onChange={handleChange}
                      options={[
                        { value: "", label: "Select State" },
                        ...malaysianStates.map((s) => ({ value: s, label: s })),
                      ]}
                    />
                  </div>

                  <div>
                    <Select
                      label="Nationality"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      options={[
                        { value: "", label: "Select Nationality" },
                        ...nationalityOptions.map((n) => ({
                          value: n,
                          label: n,
                        })),
                      ]}
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
                    <h3 className="font-semibold text-zinc-800">
                      IC Copy (KPKT Requirement)
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Upload front and back of IC
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* IC Front */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Front
                    </label>
                    <input
                      ref={icFrontRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "icFront")}
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
                          <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-2">
                            <img
                              src={icFrontImage}
                              alt="IC Front"
                              className="w-full h-48 object-contain rounded-lg"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage("icFront")}
                            className="absolute top-3 right-3 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => icFrontRef.current?.click()}
                            className="absolute bottom-3 right-3 px-2 py-1 bg-amber-500 text-white text-xs rounded-full hover:bg-amber-600 flex items-center gap-1"
                          >
                            <Upload className="w-3 h-3" />
                            Change
                          </button>
                          {imagesChanged.icFront && (
                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                              Changed
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.button
                          key="upload"
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => icFrontRef.current?.click()}
                          className="w-full h-48 border-2 border-dashed border-zinc-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-amber-500 hover:bg-amber-50 text-zinc-400 hover:text-amber-500 transition-colors"
                        >
                          <Upload className="w-8 h-8" />
                          <span className="text-sm font-medium">
                            Upload IC Front
                          </span>
                        </motion.button>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* IC Back */}
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">
                      Back
                    </label>
                    <input
                      ref={icBackRef}
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, "icBack")}
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
                          <div className="bg-zinc-50 rounded-lg border border-zinc-200 p-2">
                            <img
                              src={icBackImage}
                              alt="IC Back"
                              className="w-full h-48 object-contain rounded-lg"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage("icBack")}
                            className="absolute top-3 right-3 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => icBackRef.current?.click()}
                            className="absolute bottom-3 right-3 px-2 py-1 bg-amber-500 text-white text-xs rounded-full hover:bg-amber-600 flex items-center gap-1"
                          >
                            <Upload className="w-3 h-3" />
                            Change
                          </button>
                          {imagesChanged.icBack && (
                            <div className="absolute bottom-3 left-3 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                              Changed
                            </div>
                          )}
                        </motion.div>
                      ) : (
                        <motion.button
                          key="upload"
                          type="button"
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          onClick={() => icBackRef.current?.click()}
                          className="w-full h-48 border-2 border-dashed border-zinc-300 rounded-lg flex flex-col items-center justify-center gap-2 hover:border-amber-500 hover:bg-amber-50 text-zinc-400 hover:text-amber-500 transition-colors"
                        >
                          <Upload className="w-8 h-8" />
                          <span className="text-sm font-medium">
                            Upload IC Back
                          </span>
                        </motion.button>
                      )}
                    </AnimatePresence>
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
                    <h3 className="font-semibold text-zinc-800">
                      Profile Photo
                    </h3>
                    <p className="text-sm text-zinc-500">Optional</p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <input
                  ref={profilePhotoRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleImageUpload(e, "profile")}
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
                        onClick={() => removeImage("profile")}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => profilePhotoRef.current?.click()}
                        className="absolute bottom-2 right-2 px-3 py-1 bg-amber-500 text-white text-sm rounded-full hover:bg-amber-600 flex items-center gap-1"
                      >
                        <Upload className="w-4 h-4" />
                        Change
                      </button>
                      {imagesChanged.profile && (
                        <div className="absolute bottom-2 left-2 px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                          Changed
                        </div>
                      )}
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
                  {isSubmitting ? "Saving..." : "Save Changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  leftIcon={RotateCcw}
                  onClick={handleReset}
                >
                  Reset Changes
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  fullWidth
                  onClick={() => navigate(`/customers/${id}`)}
                >
                  Cancel
                </Button>
              </div>

              {/* Validation Summary */}
              {Object.keys(errors).some((key) => errors[key]) && (
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
                    {Object.keys(errors).map(
                      (key) => errors[key] && <li key={key}>• {errors[key]}</li>
                    )}
                  </ul>
                </motion.div>
              )}
            </Card>
          </motion.div>
        </motion.div>
      </form>
    </PageWrapper>
  );
}
