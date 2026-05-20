import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useAppDispatch, useAppSelector } from "@/app/hooks";
import {
  updateCustomer,
  setCustomers,
} from "@/features/customers/customersSlice";
import { addToast, openCamera } from "@/features/ui/uiSlice";
import { customerService } from "@/services";
import { getStorageUrl, compressImage } from "@/utils/helpers";
import { validateIC, validatePhone, validateEmail } from "@/utils/validators";
import { formatIC } from "@/utils/formatters";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import PageWrapper from "@/components/layout/PageWrapper";
import { Card, Button, Input, Select, PhoneInput } from "@/components/common";
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
  TrendingUp,
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
  "W. PERSEKUTUAN(KL)",
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

// Race options
const raceOptions = [
  "Indian",
  "Malay",
  "Chinese",
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

  // Camera capture state
  const [currentCaptureType, setCurrentCaptureType] = useState(null);
  const { capturedImage } = useAppSelector((state) => state.ui.camera);

  // Loading state
  const [isLoading, setIsLoading] = useState(true);
  const [originalCustomer, setOriginalCustomer] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    icNumber: "",
    passportNumber: "",
    phone: "",
    whatsapp: "",
    email: "",
    address: "",
    city: "",
    state: "",
    postcode: "",
    nationality: "Malaysian",
    nationalityOther: "",
    race: "",
    raceOther: "",
    dateOfBirth: "",
    gender: "",
    occupation: "",
    customInterestRate: "",
    customInterestRateExtended: "",
    customInterestRateOverdue: "",
  });

  // Foreigner detection — passport flow when nationality is not Malaysian
  const isForeigner = formData.nationality && formData.nationality !== "Malaysian";
  const isOtherNationality = formData.nationality === "Other";

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
        const isPassport = customer.ic_type === "passport";
        setFormData({
          name: customer.name || "",
          icNumber: isPassport ? "" : (customer.ic_number || ""),
          passportNumber: isPassport ? (customer.ic_number || "") : "",
          phone: (customer.country_code || "+60") + (customer.phone || ""),
          whatsapp: (customer.country_code || "+60") + (customer.phone_alt || customer.phone || ""),
          email: customer.email || "",
          address: customer.address_line1 || "",
          city: customer.city || "",
          state: customer.state || "",
          postcode: customer.postcode || "",
          nationality: customer.nationality
            ? (nationalityOptions.includes(customer.nationality) ? customer.nationality : "Other")
            : "Malaysian",
          nationalityOther: customer.nationality && !nationalityOptions.includes(customer.nationality)
            ? customer.nationality
            : "",
          race: ["Indian", "Malay", "Chinese"].includes(customer.race) ? customer.race : (customer.race ? "Other" : ""),
          raceOther: ["Indian", "Malay", "Chinese"].includes(customer.race) ? "" : (customer.race || ""),
          dateOfBirth: customer.date_of_birth
            ? customer.date_of_birth.split("T")[0]
            : "",
          gender: customer.gender || "",
          occupation: customer.occupation || "",
          customInterestRate: customer.custom_interest_rate != null ? String(customer.custom_interest_rate) : "",
          customInterestRateExtended: customer.custom_interest_rate_extended != null ? String(customer.custom_interest_rate_extended) : "",
          customInterestRateOverdue: customer.custom_interest_rate_overdue != null ? String(customer.custom_interest_rate_overdue) : "",
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

  // Fields that should NOT be auto-uppercased (dropdowns need internal values to match exactly)
  const noUppercaseFields = ["email", "gender", "state", "nationality", "race"];

  // Handle input change
  const handleChange = (e) => {
    const { name, value } = e.target;
    // Auto-uppercase all fields except email
    const finalValue = noUppercaseFields.includes(name) ? value : value.toUpperCase();
    setFormData((prev) => ({ ...prev, [name]: finalValue }));

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
        else {
          const icResult = validateIC(cleanIC);
          if (!icResult.valid) {
            error = icResult.error;
          }
        }
        break;
      case "passportNumber":
        const cleanPassport = (value || "").trim();
        if (!cleanPassport) error = "Passport number is required";
        else if (!/^[A-Z0-9]{5,15}$/i.test(cleanPassport))
          error = "Passport must be 5-15 alphanumeric characters";
        break;
      case "phone":
        if (!value || !value.trim()) error = "Phone number is required";
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
    const idField = isForeigner ? "passportNumber" : "icNumber";
    const fieldsToValidate = ["name", idField, "phone", "address"];
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
  const handleImageUpload = async (e, type) => {
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

    try {
      // Compress the image before processing
      const compressedFile = await compressImage(file, { maxWidth: 1600, maxHeight: 1600, quality: 0.8 });

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result;

        switch (type) {
          case "icFront":
            setIcFrontImage(base64);
            setIcFrontFile(compressedFile);
            setImagesChanged((prev) => ({ ...prev, icFront: true }));
            break;
          case "icBack":
            setIcBackImage(base64);
            setIcBackFile(compressedFile);
            setImagesChanged((prev) => ({ ...prev, icBack: true }));
            break;
          case "profile":
            setProfilePhoto(base64);
            setProfilePhotoFile(compressedFile);
            setImagesChanged((prev) => ({ ...prev, profile: true }));
            break;
        }

        dispatch(
          addToast({
            type: "success",
            title: "Image Added",
            message: `${type === "icFront"
              ? "IC Front"
              : type === "icBack"
                ? "IC Back"
                : "Profile Photo"
              } optimized and ready`,
          })
        );
      };
      reader.readAsDataURL(compressedFile);
    } catch (error) {
      console.error("Image processing error:", error);
      dispatch(
        addToast({
          type: "error",
          title: "Processing Failed",
          message: "Could not optimize the image",
        })
      );
    }
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

  // Handle camera capture
  const handleCameraCapture = (type) => {
    setCurrentCaptureType(type);
    const mode = type === "profile" ? "selfie" : "document";
    dispatch(openCamera({ contextId: type, mode }));
  };

  // Process captured image from camera
  useEffect(() => {
    if (capturedImage && currentCaptureType) {
      fetch(capturedImage)
        .then((res) => res.blob())
        .then((blob) => {
          const isPng = blob.type === "image/png";
          const file = new File([blob], `${currentCaptureType}.${isPng ? "png" : "jpg"}`, {
            type: blob.type || "image/jpeg",
          });

          switch (currentCaptureType) {
            case "icFront":
              setIcFrontImage(capturedImage);
              setIcFrontFile(file);
              setImagesChanged((prev) => ({ ...prev, icFront: true }));
              break;
            case "icBack":
              setIcBackImage(capturedImage);
              setIcBackFile(file);
              setImagesChanged((prev) => ({ ...prev, icBack: true }));
              break;
            case "profile":
              setProfilePhoto(capturedImage);
              setProfilePhotoFile(file);
              setImagesChanged((prev) => ({ ...prev, profile: true }));
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

          setCurrentCaptureType(null);
        });
    }
  }, [capturedImage, currentCaptureType, dispatch]);

  // Reset to original
  const handleReset = () => {
    if (!originalCustomer) return;

    const isPassport = originalCustomer.ic_type === "passport";
    setFormData({
      name: originalCustomer.name || "",
      icNumber: isPassport ? "" : (originalCustomer.ic_number || ""),
      passportNumber: isPassport ? (originalCustomer.ic_number || "") : "",
      phone: (originalCustomer.country_code || "+60") + (originalCustomer.phone || ""),
      whatsapp: (originalCustomer.country_code || "+60") + (originalCustomer.phone_alt || originalCustomer.phone || ""),
      email: originalCustomer.email || "",
      address: originalCustomer.address_line1 || "",
      city: originalCustomer.city || "",
      state: originalCustomer.state || "",
      postcode: originalCustomer.postcode || "",
      nationality: originalCustomer.nationality
        ? (nationalityOptions.includes(originalCustomer.nationality) ? originalCustomer.nationality : "Other")
        : "Malaysian",
      nationalityOther: originalCustomer.nationality && !nationalityOptions.includes(originalCustomer.nationality)
        ? originalCustomer.nationality
        : "",
      race: ["Indian", "Malay", "Chinese"].includes(originalCustomer.race) ? originalCustomer.race : (originalCustomer.race ? "Other" : ""),
      raceOther: ["Indian", "Malay", "Chinese"].includes(originalCustomer.race) ? "" : (originalCustomer.race || ""),
      dateOfBirth: originalCustomer.date_of_birth
        ? originalCustomer.date_of_birth.split("T")[0]
        : "",
      gender: originalCustomer.gender || "",
      occupation: originalCustomer.occupation || "",
      customInterestRate: originalCustomer.custom_interest_rate != null ? String(originalCustomer.custom_interest_rate) : "",
      customInterestRateExtended: originalCustomer.custom_interest_rate_extended != null ? String(originalCustomer.custom_interest_rate_extended) : "",
      customInterestRateOverdue: originalCustomer.custom_interest_rate_overdue != null ? String(originalCustomer.custom_interest_rate_overdue) : "",
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
      // Parse phone number to extract country code
      const parsePhoneNumber = (phoneValue) => {
        if (!phoneValue) return { countryCode: "+60", phone: "" };
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
      const parsedWhatsApp = parsePhoneNumber(formData.whatsapp || formData.phone);

      const customerData = {
        name: formData.name.trim(),
        ic_number: isForeigner
          ? formData.passportNumber.trim().toUpperCase()
          : formData.icNumber.replace(/[-\s]/g, ""),
        ic_type: isForeigner ? "passport" : "mykad",
        phone: parsedPhone.phone,
        country_code: parsedPhone.countryCode,
        whatsapp: parsedWhatsApp.phone,
        email: formData.email.trim() || null,
        address: formData.address.trim(),
        city: formData.city.trim() || null,
        state: formData.state || null,
        postcode: formData.postcode.trim() || null,
        nationality: formData.nationality === "Other"
          ? (formData.nationalityOther.trim() || "Other")
          : (formData.nationality || "Malaysian"),
        race: formData.race === "Other" ? (formData.raceOther.trim() || "Other") : (formData.race || null),
        date_of_birth: formData.dateOfBirth || null,
        gender: formData.gender || null,
        occupation: formData.occupation.trim() || null,
        custom_interest_rate: formData.customInterestRate ? parseFloat(formData.customInterestRate) : null,
        custom_interest_rate_extended: formData.customInterestRateExtended ? parseFloat(formData.customInterestRateExtended) : null,
        custom_interest_rate_overdue: formData.customInterestRateOverdue ? parseFloat(formData.customInterestRateOverdue) : null,
      };

      // Only add files if they were changed
      if (imagesChanged.icFront) {
        if (icFrontFile) {
          customerData.ic_front_image = icFrontFile;
        } else {
          customerData.remove_ic_front_image = true;
        }
      }
      if (imagesChanged.icBack) {
        if (icBackFile) {
          customerData.ic_back_image = icBackFile;
        } else {
          customerData.remove_ic_back_image = true;
        }
      }
      if (imagesChanged.profile) {
        if (profilePhotoFile) {
          customerData.profile_photo = profilePhotoFile;
        } else {
          customerData.remove_profile_photo = true;
        }
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
            ic_number: isForeigner ? "passportNumber" : "icNumber",
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

                  {/* Nationality */}
                  <div>
                    <Select
                      label="Nationality"
                      name="nationality"
                      value={formData.nationality}
                      onChange={handleChange}
                      options={[
                        { value: "", label: "Select an option" },
                        ...nationalityOptions.map((n) => ({
                          value: n,
                          label: n.toUpperCase(),
                        })),
                      ]}
                      required
                    />
                  </div>

                  {/* Nationality Other - Manual Input */}
                  {isOtherNationality && (
                    <div className="md:col-span-2">
                      <Input
                        label="Specify Nationality"
                        name="nationalityOther"
                        placeholder="Enter nationality"
                        value={formData.nationalityOther}
                        onChange={handleChange}
                        required
                      />
                    </div>
                  )}

                  {/* IC Number or Passport Number */}
                  {isForeigner ? (
                    <div>
                      <Input
                        label="Passport Number"
                        name="passportNumber"
                        placeholder="Enter passport number"
                        value={formData.passportNumber}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        error={touched.passportNumber && errors.passportNumber}
                        required
                        leftIcon={CreditCard}
                      />
                    </div>
                  ) : (
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
                  )}

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
                        { value: "", label: "Select an option" },
                        { value: "male", label: "MALE" },
                        { value: "female", label: "FEMALE" },
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
                      countryCallingCodeEditable={false}
                    />
                  </div>

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
                      countryCallingCodeEditable={false}
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
                        { value: "", label: "Select an option" },
                        ...malaysianStates.map((s) => ({ value: s, label: s.toUpperCase() })),
                      ]}
                    />
                  </div>

                  {/* Race */}
                  <div>
                    <Select
                      label="Race"
                      name="race"
                      value={formData.race}
                      onChange={handleChange}
                      options={[
                        { value: "", label: "Select an option" },
                        ...raceOptions.map((r) => ({
                          value: r,
                          label: r.toUpperCase(),
                        })),
                      ]}
                    />
                  </div>

                  {/* Race Other - Manual Input */}
                  {formData.race === "Other" && (
                    <div>
                      <Input
                        label="Specify Race"
                        name="raceOther"
                        placeholder="Enter race"
                        value={formData.raceOther}
                        onChange={handleChange}
                      />
                    </div>
                  )}
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
                      {isForeigner ? "Passport Copy (KPKT Requirement)" : "IC Copy (KPKT Requirement)"}
                    </h3>
                    <p className="text-sm text-zinc-500">
                      {isForeigner ? "Upload front and back of passport" : "Upload front and back of IC"}
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
                        <div className="space-y-2">
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
                              {isForeigner ? "Upload Passport Front" : "Upload IC Front"}
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
                        <div className="space-y-2">
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
                              {isForeigner ? "Upload Passport Back" : "Upload IC Back"}
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
                  <div className="w-10 h-10 rounded-lg bg-sky-100 flex items-center justify-center">
                    <Camera className="w-5 h-5 text-sky-600" />
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
                        className="w-full py-2.5 px-4 bg-sky-500 text-white rounded-lg hover:bg-sky-600 transition-colors flex items-center justify-center gap-2 text-sm font-medium"
                      >
                        <Camera className="w-4 h-4" />
                        Take Selfie with Camera
                      </button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </Card>

            {/* Custom Interest Rates */}
            <Card>
              <div className="p-5 border-b border-zinc-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-zinc-800">
                      Custom Interest Rates
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Optional per-person rate override
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-5">
                <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-xs text-blue-700">
                    <strong>Leave empty</strong> to use global interest rates from Settings. If set, these rates will auto-apply when creating a new pledge for this customer.
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Standard Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="99"
                      name="customInterestRate"
                      value={formData.customInterestRate}
                      onChange={handleChange}
                      placeholder="e.g. 1.50"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Extended Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="99"
                      name="customInterestRateExtended"
                      value={formData.customInterestRateExtended}
                      onChange={handleChange}
                      placeholder="e.g. 1.00"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Overdue Rate (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="99"
                      name="customInterestRateOverdue"
                      value={formData.customInterestRateOverdue}
                      onChange={handleChange}
                      placeholder="e.g. 2.00"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 focus:border-violet-500 focus:ring-1 focus:ring-violet-500 text-sm transition-colors"
                    />
                  </div>
                  {(formData.customInterestRate || formData.customInterestRateExtended || formData.customInterestRateOverdue) && (
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, customInterestRate: "", customInterestRateExtended: "", customInterestRateOverdue: "" }))}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 mt-1"
                    >
                      <X className="w-3 h-3" /> Clear all custom rates (use global defaults)
                    </button>
                  )}
                </div>
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
