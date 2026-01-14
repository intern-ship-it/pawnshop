import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import { addCustomer, setCustomers } from "@/features/customers/customersSlice";
import { addToast, openCamera, closeCamera } from "@/features/ui/uiSlice";
import {
  getStorageItem,
  setStorageItem,
  STORAGE_KEYS,
} from "@/utils/localStorage";
import { validateIC, validatePhone, validateEmail } from "@/utils/validators";
import { formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, PhoneInput } from "@/components/common";
import { customerService } from "@/services";
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
} from "lucide-react";

export default function CustomerCreate() {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const [searchParams] = useSearchParams();
  const { customers } = useAppSelector((state) => state.customers);

  // File input refs
  const icFrontRef = useRef(null);
  const icBackRef = useRef(null);
  const profilePhotoRef = useRef(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    icNumber: searchParams.get("ic") || "",
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
  // Image states
  const [icFrontImage, setIcFrontImage] = useState(null);
  const [icBackImage, setIcBackImage] = useState(null);
  const [profilePhoto, setProfilePhoto] = useState(null);

  const [icFrontFile, setIcFrontFile] = useState(null);
  const [icBackFile, setIcBackFile] = useState(null);
  const [profilePhotoFile, setProfilePhotoFile] = useState(null);
  // Validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sameAsPhone, setSameAsPhone] = useState(true);
  const [currentCaptureType, setCurrentCaptureType] = useState(null); // 'icFront', 'icBack', or 'profile'

  // Get camera state from Redux
  const { capturedImage } = useAppSelector((state) => state.ui.camera);

  // Load customers on mount
  useEffect(() => {
    const storedCustomers = getStorageItem(STORAGE_KEYS.CUSTOMERS, []);
    dispatch(setCustomers(storedCustomers));
  }, [dispatch]);

  // Auto-fill WhatsApp when phone changes
  useEffect(() => {
    if (sameAsPhone) {
      setFormData((prev) => ({ ...prev, whatsapp: prev.phone }));
    }
  }, [formData.phone, sameAsPhone]);

  // Malaysian state codes mapping (digits 7-8 of IC)
  const stateCodeMap = {
    "01": "Johor",
    21: "Johor",
    22: "Johor",
    23: "Johor",
    24: "Johor",
    "02": "Kedah",
    25: "Kedah",
    26: "Kedah",
    27: "Kedah",
    "03": "Kelantan",
    28: "Kelantan",
    29: "Kelantan",
    "04": "Melaka",
    30: "Melaka",
    "05": "Negeri Sembilan",
    31: "Negeri Sembilan",
    59: "Negeri Sembilan",
    "06": "Pahang",
    32: "Pahang",
    33: "Pahang",
    "07": "Pulau Pinang",
    34: "Pulau Pinang",
    35: "Pulau Pinang",
    "08": "Perak",
    36: "Perak",
    37: "Perak",
    38: "Perak",
    39: "Perak",
    "09": "Perlis",
    40: "Perlis",
    10: "Selangor",
    41: "Selangor",
    42: "Selangor",
    43: "Selangor",
    44: "Selangor",
    11: "Terengganu",
    45: "Terengganu",
    46: "Terengganu",
    12: "Sabah",
    47: "Sabah",
    48: "Sabah",
    49: "Sabah",
    13: "Sarawak",
    50: "Sarawak",
    51: "Sarawak",
    52: "Sarawak",
    53: "Sarawak",
    14: "Kuala Lumpur",
    54: "Kuala Lumpur",
    55: "Kuala Lumpur",
    56: "Kuala Lumpur",
    57: "Kuala Lumpur",
    15: "Labuan",
    58: "Labuan",
    16: "Putrajaya",
  };

  // Postcode mapping by state (starting postcode of capital city)
  const statePostcodeMap = {
    Johor: "80000", // Johor Bahru: 80000-81900
    Kedah: "05000", // Alor Setar: 05000-06650
    Kelantan: "15000", // Kota Bharu: 15000-16810
    Melaka: "75000", // Melaka City: 75000-75990
    "Negeri Sembilan": "70000", // Seremban: 70000-71900
    Pahang: "25000", // Kuantan: 25000-26900
    "Pulau Pinang": "10000", // George Town: 10000-14400
    Perak: "30000", // Ipoh: 30000-31650
    Perlis: "01000", // Kangar: 01000-02600
    Selangor: "40000", // Shah Alam: 40000-40920
    Terengganu: "20000", // Kuala Terengganu: 20000-21810
    Sabah: "88000", // Kota Kinabalu: 88000-89509
    Sarawak: "93000", // Kuching: 93000-93990
    "Kuala Lumpur": "50000", // KL City: 50000-60000
    Labuan: "87000", // Labuan: 87000-87033
    Putrajaya: "62000", // Putrajaya: 62000-62988
  };

  // City mapping by state (official capital cities)
  const stateCityMap = {
    Johor: "Johor Bahru",
    Kedah: "Alor Setar",
    Kelantan: "Kota Bharu",
    Melaka: "Melaka City",
    "Negeri Sembilan": "Seremban",
    Pahang: "Kuantan",
    "Pulau Pinang": "George Town",
    Perak: "Ipoh",
    Perlis: "Kangar",
    Selangor: "Shah Alam",
    Terengganu: "Kuala Terengganu",
    Sabah: "Kota Kinabalu",
    Sarawak: "Kuching",
    "Kuala Lumpur": "Kuala Lumpur",
    Labuan: "Labuan",
    Putrajaya: "Putrajaya",
  };

  // Extract DOB, Gender, and State from IC
  useEffect(() => {
    const ic = formData.icNumber.replace(/[-\s]/g, "");

    if (ic.length >= 6) {
      // Extract DOB
      const year = ic.substring(0, 2);
      const month = ic.substring(2, 4);
      const day = ic.substring(4, 6);

      // Determine century (00-30 = 2000s, 31-99 = 1900s)
      const fullYear = parseInt(year) <= 30 ? `20${year}` : `19${year}`;
      const dob = `${fullYear}-${month}-${day}`;

      // Validate date
      const dateObj = new Date(dob);
      if (!isNaN(dateObj.getTime())) {
        setFormData((prev) => ({ ...prev, dateOfBirth: dob }));
      }
    }

    if (ic.length >= 8) {
      // Extract state from digits 7-8
      const stateCode = ic.substring(6, 8);
      const state = stateCodeMap[stateCode];
      if (state) {
        const postcode = statePostcodeMap[state];
        const city = stateCityMap[state];
        setFormData((prev) => ({
          ...prev,
          state,
          city: city || prev.city,
          postcode: postcode || prev.postcode,
        }));
      }
    }

    if (ic.length === 12) {
      // Extract gender from last digit (odd=male, even=female)
      const lastDigit = parseInt(ic.substring(11, 12));
      const gender = lastDigit % 2 === 0 ? "female" : "male";
      setFormData((prev) => ({ ...prev, gender }));
    }
  }, [formData.icNumber]);

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;

    // Auto-format IC number with dashes
    if (name === "icNumber") {
      const cleaned = value.replace(/[-\s]/g, "");
      let formatted = cleaned;

      if (cleaned.length > 6 && cleaned.length <= 8) {
        formatted = `${cleaned.slice(0, 6)}-${cleaned.slice(6)}`;
      } else if (cleaned.length > 8) {
        formatted = `${cleaned.slice(0, 6)}-${cleaned.slice(
          6,
          8
        )}-${cleaned.slice(8, 12)}`;
      }

      setFormData((prev) => ({ ...prev, [name]: formatted }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    // Clear error on change
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
        else {
          // Check for duplicate (local check)
          const exists = customers.find(
            (c) => c.icNumber?.replace(/[-\s]/g, "") === cleanIC
          );
          if (exists) error = "Customer with this IC already exists";
        }
        break;
      case "phone":
        if (!value || !value.trim()) error = "Phone number is required";
        else if (!value.startsWith("+"))
          error = "Phone must include country code";
        else if (value.length < 10) error = "Phone number is too short";
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

    // Check IC images (KPKT requirement)
    if (!icFrontImage) {
      setErrors((prev) => ({ ...prev, icFront: "IC front image is required" }));
      isValid = false;
    }
    if (!icBackImage) {
      setErrors((prev) => ({ ...prev, icBack: "IC back image is required" }));
      isValid = false;
    }

    return isValid;
  };

  // Handle image upload
  const handleImageUpload = (e, type) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
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

    // Validate file size (max 5MB)
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

    // Convert to base64 for preview
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result;

      switch (type) {
        case "icFront":
          setIcFrontImage(base64);
          setIcFrontFile(file); // ADD: Store file object
          setErrors((prev) => ({ ...prev, icFront: null }));
          break;
        case "icBack":
          setIcBackImage(base64);
          setIcBackFile(file); // ADD: Store file object
          setErrors((prev) => ({ ...prev, icBack: null }));
          break;
        case "profile":
          setProfilePhoto(base64);
          setProfilePhotoFile(file); // ADD: Store file object
          break;
      }

      dispatch(
        addToast({
          type: "success",
          title: "Image Uploaded",
          message: `${
            type === "icFront"
              ? "IC Front"
              : type === "icBack"
              ? "IC Back"
              : "Profile Photo"
          } uploaded successfully`,
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
        setIcFrontFile(null); // ADD
        if (icFrontRef.current) icFrontRef.current.value = "";
        break;
      case "icBack":
        setIcBackImage(null);
        setIcBackFile(null); // ADD
        if (icBackRef.current) icBackRef.current.value = "";
        break;
      case "profile":
        setProfilePhoto(null);
        setProfilePhotoFile(null); // ADD
        if (profilePhotoRef.current) profilePhotoRef.current.value = "";
        break;
    }
  };

  // Handle camera capture
  const handleCameraCapture = (type) => {
    setCurrentCaptureType(type);
    dispatch(openCamera({ contextId: type }));
  };

  // Process captured image from camera
  useEffect(() => {
    if (capturedImage && currentCaptureType) {
      // Convert base64 to File object
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const file = new File([blob], `${currentCaptureType}.jpg`, {
            type: "image/jpeg",
          });

          // Set the image based on type
          switch (currentCaptureType) {
            case "icFront":
              setIcFrontImage(capturedImage);
              setIcFrontFile(file);
              setErrors((prev) => ({ ...prev, icFront: null }));
              break;
            case "icBack":
              setIcBackImage(capturedImage);
              setIcBackFile(file);
              setErrors((prev) => ({ ...prev, icBack: null }));
              break;
            case "profile":
              setProfilePhoto(capturedImage);
              setProfilePhotoFile(file);
              break;
          }

          dispatch(
            addToast({
              type: "success",
              title: "Photo Captured",
              message: `${
                currentCaptureType === "icFront"
                  ? "IC Front"
                  : currentCaptureType === "icBack"
                  ? "IC Back"
                  : "Profile Photo"
              } captured successfully`,
            })
          );

          // Reset capture type
          setCurrentCaptureType(null);
        });
    }
  }, [capturedImage, currentCaptureType, dispatch]);

  // Handle form submit - API INTEGRATED
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
      // Parse phone number to extract country code
      const parsePhoneNumber = (phoneValue) => {
        if (!phoneValue) return { countryCode: "+60", phone: "" };

        // Phone is in E.164 format (e.g., "+60123456789")
        const match = phoneValue.match(/^(\+\d{1,4})(.+)$/);
        if (match) {
          return {
            countryCode: match[1],
            phone: match[2].replace(/\s/g, ""),
          };
        }
        return { countryCode: "+60", phone: phoneValue };
      };

      const parsedPhone = parsePhoneNumber(formData.phone);
      const parsedWhatsApp = parsePhoneNumber(
        formData.whatsapp || formData.phone
      );

      // Prepare data for API
      const customerData = {
        name: formData.name.trim(),
        ic_number: formData.icNumber.replace(/[-\s]/g, ""),
        ic_type: "mykad",
        phone: parsedPhone.phone,
        country_code: parsedPhone.countryCode,
        whatsapp: parsedWhatsApp.phone,
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

      // ADD: Only add files if they exist
      if (icFrontFile) {
        customerData.ic_front_image = icFrontFile;
      }
      if (icBackFile) {
        customerData.ic_back_image = icBackFile;
      }
      if (profilePhotoFile) {
        customerData.profile_photo = profilePhotoFile;
      }

      // Call API
      const response = await customerService.create(customerData);
      const newCustomer = response.data || response;

      // Update Redux store
      dispatch(addCustomer(newCustomer));

      dispatch(
        addToast({
          type: "success",
          title: "Customer Created",
          message: `${formData.name} has been added successfully`,
        })
      );

      // Navigate to customer detail
      navigate(`/customers/${newCustomer.id}`);
    } catch (error) {
      console.error("Error creating customer:", error);

      // Handle validation errors from API
      if (error.response?.data?.errors) {
        const apiErrors = error.response.data.errors;
        const formattedErrors = {};
        Object.keys(apiErrors).forEach((key) => {
          const fieldMap = {
            ic_number: "icNumber",
            date_of_birth: "dateOfBirth",
            ic_type: "icType",
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
          message: error.response?.data?.message || "Failed to create customer",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  };

  return (
    <PageWrapper
      title="Add New Customer"
      subtitle="Register a new customer in the system"
      actions={
        <Button
          variant="outline"
          leftIcon={ArrowLeft}
          onClick={() => navigate("/customers")}
        >
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
                        { value: "", label: "Select Gender" },
                        { value: "male", label: "Male" },
                        { value: "female", label: "Female" },
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
                  {/* Phone */}
                  <div>
                    <PhoneInput
                      label="Phone Number"
                      value={formData.phone}
                      onChange={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          phone: value || "",
                        }));
                        if (errors.phone) {
                          setErrors((prev) => ({ ...prev, phone: null }));
                        }
                      }}
                      error={touched.phone && errors.phone}
                      required
                      placeholder="Enter phone number"
                      defaultCountry="MY"
                      helperText="Include country code (e.g., +60 for Malaysia)"
                    />
                  </div>

                  {/* WhatsApp */}
                  <div>
                    <PhoneInput
                      label="WhatsApp Number"
                      value={formData.whatsapp}
                      onChange={(value) => {
                        setFormData((prev) => ({
                          ...prev,
                          whatsapp: value || "",
                        }));
                      }}
                      disabled={sameAsPhone}
                      placeholder="Enter WhatsApp number"
                      defaultCountry="MY"
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
                  {/* City */}
                  <div>
                    <Input
                      label="City"
                      name="city"
                      placeholder="Enter city"
                      value={formData.city}
                      onChange={handleChange}
                      hint="Auto-filled from IC state"
                    />
                  </div>

                  {/* Postcode */}
                  <div>
                    <Input
                      label="Postcode"
                      name="postcode"
                      placeholder="e.g., 50000"
                      value={formData.postcode}
                      onChange={handleChange}
                      maxLength={5}
                      hint="Auto-filled from IC state"
                    />
                  </div>

                  {/* State */}
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

                  {/* Nationality */}
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
                      IC Front <span className="text-red-500">*</span>
                    </label>
                    <input
                      ref={icFrontRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
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
                          className="relative group"
                        >
                          <div className="w-full h-48 bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-200">
                            <img
                              src={icFrontImage}
                              alt="IC Front"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage("icFront")}
                            className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-500/90 text-white text-xs rounded-full flex items-center gap-1 backdrop-blur-sm">
                            <Check className="w-3 h-3" />
                            Uploaded
                          </div>
                        </motion.div>
                      ) : (
                        <div className="space-y-2">
                          <motion.button
                            key="upload"
                            type="button"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={() => icFrontRef.current?.click()}
                            className={cn(
                              "w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors",
                              errors.icFront
                                ? "border-red-300 bg-red-50 text-red-500"
                                : "border-zinc-300 hover:border-amber-500 hover:bg-amber-50 text-zinc-400 hover:text-amber-500"
                            )}
                          >
                            <Upload className="w-8 h-8" />
                            <span className="text-sm font-medium">
                              Upload IC Front
                            </span>
                            <span className="text-xs">
                              Click to upload or use camera
                            </span>
                          </motion.button>
                          <button
                            type="button"
                            onClick={() => handleCameraCapture("icFront")}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <Camera className="w-4 h-4" />
                            Take Photo with Camera
                          </button>
                        </div>
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
                      capture="environment"
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
                          className="relative group"
                        >
                          <div className="w-full h-48 bg-zinc-900 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-200">
                            <img
                              src={icBackImage}
                              alt="IC Back"
                              className="max-w-full max-h-full object-contain"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeImage("icBack")}
                            className="absolute top-2 right-2 p-1.5 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors backdrop-blur-sm opacity-0 group-hover:opacity-100"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="absolute bottom-2 left-2 px-2 py-1 bg-emerald-500/90 text-white text-xs rounded-full flex items-center gap-1 backdrop-blur-sm">
                            <Check className="w-3 h-3" />
                            Uploaded
                          </div>
                        </motion.div>
                      ) : (
                        <div className="space-y-2">
                          <motion.button
                            key="upload"
                            type="button"
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            onClick={() => icBackRef.current?.click()}
                            className={cn(
                              "w-full h-40 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-2 transition-colors",
                              errors.icBack
                                ? "border-red-300 bg-red-50 text-red-500"
                                : "border-zinc-300 hover:border-amber-500 hover:bg-amber-50 text-zinc-400 hover:text-amber-500"
                            )}
                          >
                            <Upload className="w-8 h-8" />
                            <span className="text-sm font-medium">
                              Upload IC Back
                            </span>
                            <span className="text-xs">
                              Click to upload or use camera
                            </span>
                          </motion.button>
                          <button
                            type="button"
                            onClick={() => handleCameraCapture("icBack")}
                            className="w-full py-2 px-4 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                          >
                            <Camera className="w-4 h-4" />
                            Take Photo with Camera
                          </button>
                        </div>
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
                  capture="user"
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
                    </motion.div>
                  ) : (
                    <div className="space-y-3">
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
                      <button
                        type="button"
                        onClick={() => handleCameraCapture("profile")}
                        className="w-full py-2.5 px-4 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <Camera className="w-4 h-4" />
                        Take Selfie with Camera
                      </button>
                    </div>
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
                  {isSubmitting ? "Saving..." : "Save Customer"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  fullWidth
                  onClick={() => navigate("/customers")}
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
  );
}
