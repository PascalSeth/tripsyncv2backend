"use client"
// Keep your existing imports as they are
import { GOOGLE_MAPS_API_KEY } from "'config'" (see below for file content)
import { bookingsApi } from "'services/driverApi'" (see below for file content)
import { useAppDispatch, useAppSelector } from "'store/hooks'" (see below for file content)
import {
  setDriverAvailability,
  setDriverOnlineStatus,
  updateDriverEarnings,
  updateDriverLocation,
} from "'store/slices/driverSlice'" (see below for file content)
import * as Location from "expo-location"
import { useEffect, useRef, useState } from "react"
import { Alert, Animated, Dimensions, Modal, StatusBar, Text, TouchableOpacity, View } from "react-native"
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, type Region } from "react-native-maps"
import { io } from "socket.io-client"
import tw from "twrnc"

const { width, height } = Dimensions.get("window")

// Constants
const BACKEND_API_URL = process.env.EXPO_PUBLIC_BACKEND_API_URL || "http://172.20.10.2:3000"

// Types
interface DriverLocation extends Region {
  latitude: number
  longitude: number
  latitudeDelta: number
  longitudeDelta: number
}

interface LocationData {
  latitude: number
  longitude: number
}

interface RideRequest {
  id: string
  passengerName: string
  pickupLocation: {
    latitude: number
    longitude: number
    address?: string
  }
  destinationLocation: {
    latitude: number
    longitude: number
    address?: string
  }
  fare: number
  distance: string
  estimatedTime: string
  passengerRating: number
  status: string
  createdAt: string
}

interface RouteCoordinate {
  latitude: number
  longitude: number
}

enum DriverStatus {
  OFFLINE = "offline",
  ONLINE = "online",
  HEADING_TO_PICKUP = "heading_to_pickup",
  ARRIVED_AT_PICKUP = "arrived_at_pickup",
  ON_RIDE = "on_ride",
}

// Role-based configuration
const getRoleConfig = (userRole: string) => {
  switch (userRole) {
    case "TAXI_DRIVER":
      return {
        apiBase: "/taxi-driver",
        events: {
          bookingAccepted: "taxi_booking_accepted",
          driverArrived: "taxi_driver_arrived",
          tripStarted: "taxi_trip_started",
          tripCompleted: "taxi_trip_completed",
          locationUpdate: "taxi_driver_location_update",
          availabilityUpdate: "taxi_driver_availability_update"
        }
      }
    case "DISPATCH_RIDER":
      return {
        apiBase: "/dispatch-rider",
        events: {
          bookingAccepted: "dispatch_booking_accepted",
          driverArrived: "dispatch_driver_arrived",
          tripStarted: "dispatch_trip_started",
          tripCompleted: "dispatch_trip_completed",
          locationUpdate: "dispatch_driver_location_update",
          availabilityUpdate: "dispatch_driver_availability_update"
        }
      }
    case "DRIVER":
    default:
      return {
        apiBase: "/driver",
        events: {
          bookingAccepted: "booking_accepted",
          driverArrived: "driver_arrived",
          tripStarted: "trip_started",
          tripCompleted: "trip_completed",
          locationUpdate: "driver_location_update",
          availabilityUpdate: "driver_availability_update"
        }
      }
  }
}

const UberDriverApp = () => {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOnline, setIsOnline] = useState(false)
  const [driverStatus, setDriverStatus] = useState<DriverStatus>(DriverStatus.OFFLINE)
  const [currentRideRequest, setCurrentRideRequest] = useState<RideRequest | null>(null)
  const [showRideRequest, setShowRideRequest] = useState(false)
  const [routeCoordinates, setRouteCoordinates] = useState<RouteCoordinate[]>([])
  const [earnings, setEarnings] = useState(0)
  const [ridesCompleted, setRidesCompleted] = useState(0)
  const [isLoadingRequest, setIsLoadingRequest] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [currentBookingId, setCurrentBookingId] = useState<string | null>(null)

  const mapRef = useRef<MapView>(null)
  const pulseAnim = useRef(new Animated.Value(1)).current
  const socketRef = useRef<any>(null)
  const [lastSentLocation, setLastSentLocation] = useState<LocationData | null>(null)
  const [locationWatcher, setLocationWatcher] = useState<Location.LocationSubscription | null>(null)
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null)

  const LOCATION_UPDATE_THRESHOLD = 10 // 10 meters
  const LOCATION_UPDATE_INTERVAL = 3000 // 3 seconds

  // Redux
  const dispatch = useAppDispatch()
  const { profile: driverProfile } = useAppSelector((state) => state.driver)
  const { token } = useAppSelector((state) => state.auth)
  const { user } = useAppSelector((state) => state.auth)

  console.log("Driver user:", user)

  // Get role-based configuration
  const roleConfig = user?.role ? getRoleConfig(user.role) : getRoleConfig("DRIVER")

  useEffect(() => {
    getCurrentLocation()
    startPulseAnimation()

    // Initialize earnings from profile
    if (driverProfile) {
      setEarnings(driverProfile.totalEarnings || 0)
      setRidesCompleted(driverProfile.totalRides || 0)
      const profileOnlineStatus = driverProfile.isOnline || false
      setIsOnline(profileOnlineStatus)
      setDriverStatus(profileOnlineStatus ? DriverStatus.ONLINE : DriverStatus.OFFLINE)
      console.log(
        `📊 Profile loaded - Online: ${profileOnlineStatus}, Status: ${profileOnlineStatus ? "ONLINE" : "OFFLINE"}`,
      )
    }

    return () => {
      // Cleanup on unmount
      if (locationWatcher) {
        locationWatcher.remove()
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
      }
      if (socketRef.current) {
        console.log("🔌 UberDriverApp: Disconnecting WebSocket on unmount.")
        socketRef.current.disconnect()
      }
    }
  }, [])

  // Enhanced location updates management
  useEffect(() => {
    if (isOnline && driverLocation) {
      startLocationUpdates()
    } else {
      stopLocationUpdates()
    }

    return () => {
      stopLocationUpdates()
    }
  }, [isOnline, driverLocation])

  // Enhanced WebSocket connection and event listeners
  useEffect(() => {
    if (token && user?.id && !socketRef.current) {
      console.log(`🔌 UberDriverApp: Attempting to connect WebSocket to ${BACKEND_API_URL}...`)
      const socket = io(BACKEND_API_URL, {
        auth: {
          token: token,
        },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      })

      // Add wildcard listener to catch all events for debugging
      socket.onAny((eventName, ...args) => {
        console.log(`🌟 Driver WebSocket Event Received: ${eventName}`, args)
      })

      socket.on("connect", () => {
        console.log("✅ UberDriverApp: Driver WebSocket connected successfully!")
        console.log(`✅ Socket ID: ${socket.id}`)
        setIsConnected(true)

        // Join driver-specific room
        socket.emit("join_room", `user_${user.id}`)
        console.log(`🏠 Joined room: user_${user.id}`)

        // Emit initial status if already online
        if (isOnline && driverLocation) {
          const statusPayload = {
            isOnline: true,
            isAvailable: driverStatus === DriverStatus.ONLINE,
            currentLatitude: driverLocation.latitude,
            currentLongitude: driverLocation.longitude,
            driverStatus: driverStatus,
          }
          socket.emit("provider:status", statusPayload)
          console.log(`📡 Emitted initial provider:status:`, statusPayload)
        }
      })

      socket.on("disconnect", (reason: string) => {
        console.log(`❌ UberDriverApp: Driver WebSocket disconnected. Reason: ${reason}`)
        setIsConnected(false)
        if (reason === "io server disconnect") {
          socket.connect()
        }
      })

      socket.on("connect_error", (err: Error) => {
        console.error(`🚨 UberDriverApp: Driver WebSocket connection error: ${err.message}`, err)
        setIsConnected(false)
        Alert.alert("Connection Error", `Failed to connect to server: ${err.message}. Please check your network.`)
      })

      // Role-based booking request listener
      socket.on("new_booking_request", (payload: any) => {
        console.log("🔔 UberDriverApp: Received 'new_booking_request' event:", JSON.stringify(payload, null, 2))
        console.log(`🔍 Current state - Online: ${isOnline}, Status: ${driverStatus}`)

        // Check if driver is available for new requests
        if (isOnline && driverStatus === DriverStatus.ONLINE) {
          console.log("✅ Driver is available to receive booking requests")

          if (payload?.bookingId && payload?.customerName && payload?.pickupLocation && payload?.dropoffLocation) {
            const rideRequest: RideRequest = {
              id: payload.bookingId,
              passengerName: payload.customerName,
              pickupLocation: {
                latitude: payload.pickupLocation.latitude,
                longitude: payload.pickupLocation.longitude,
                address: payload.pickupLocation.address || "Pickup Location",
              },
              destinationLocation: {
                latitude: payload.dropoffLocation.latitude,
                longitude: payload.dropoffLocation.longitude,
                address: payload.dropoffLocation.address || "Destination",
              },
              fare: payload.estimatedPrice || 0,
              distance: payload.estimatedDistance ? `${(payload.estimatedDistance / 1000).toFixed(1)} km` : "N/A",
              estimatedTime: payload.estimatedDuration ? `${payload.estimatedDuration} min` : "N/A",
              passengerRating: payload.customerRating || 4.5,
              status: "PENDING",
              createdAt: payload.createdAt || new Date().toISOString(),
            }

            console.log("🎯 Setting ride request:", rideRequest)
            setCurrentRideRequest(rideRequest)
            setShowRideRequest(true)

            // Animate map to pickup location
            mapRef.current?.animateToRegion(
              {
                latitude: payload.pickupLocation.latitude,
                longitude: payload.pickupLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              },
              1000,
            )
          } else {
            console.warn("⚠️ UberDriverApp: Incomplete booking data received:", payload)
          }
        } else {
          console.log(
            `ℹ️ UberDriverApp: Driver not available for requests. Online: ${isOnline}, Status: ${driverStatus}`,
          )
        }
      })

      // Role-based booking acceptance confirmation
      socket.on(roleConfig.events.bookingAccepted, (payload: any) => {
        console.log(`🔔 UberDriverApp: Received '${roleConfig.events.bookingAccepted}' event:`, JSON.stringify(payload, null, 2))
        if (currentRideRequest && payload.bookingId === currentRideRequest.id) {
          setCurrentBookingId(payload.bookingId)
          Alert.alert(
            "Booking Accepted!",
            `You've accepted the ride for ${payload.customer?.name || currentRideRequest.passengerName}. Head to pickup location.`,
            [
              {
                text: "OK",
                onPress: () => {
                  console.log("✅ Booking acceptance confirmed by backend")
                },
              },
            ],
          )
        }
      })

      // Role-based driver status updates
      socket.on("driver_status_update", (update: any) => {
        console.log("🔔 UberDriverApp: Received 'driver_status_update' event:", JSON.stringify(update, null, 2))

        if (currentRideRequest && update.bookingId === currentRideRequest.id) {
          switch (update.status) {
            case "DRIVER_ARRIVED":
              setDriverStatus(DriverStatus.ARRIVED_AT_PICKUP)
              Alert.alert("Arrival Confirmed", update.message || "You have arrived at the pickup location.")
              break

            case "TRIP_STARTED":
            case "IN_PROGRESS":
              setDriverStatus(DriverStatus.ON_RIDE)
              // Get route to destination
              if (currentRideRequest) {
                getDirectionsRoute(currentRideRequest.pickupLocation, currentRideRequest.destinationLocation)
                  .then(setRouteCoordinates)
                  .catch(console.error)
              }
              Alert.alert("Trip Started", update.message || "Trip has started successfully.")
              break

            case "TRIP_COMPLETED":
            case "COMPLETED":
              const earnings = update.earnings
              Alert.alert(
                "Trip Completed!",
                `${update.message || "Trip completed successfully!"}\nTotal Earnings: GH₵${earnings?.totalEarnings || 0}\nTotal Rides: ${earnings?.totalRides || 0}`,
                [
                  {
                    text: "Continue",
                    onPress: () => {
                      setCurrentRideRequest(null)
                      setCurrentBookingId(null)
                      setRouteCoordinates([])
                      setDriverStatus(DriverStatus.ONLINE)
                      if (earnings) {
                        setEarnings(earnings.totalEarnings)
                        setRidesCompleted(earnings.totalRides)
                        dispatch(
                          updateDriverEarnings({
                            totalEarnings: earnings.totalEarnings,
                            monthlyEarnings: earnings.totalEarnings,
                          }),
                        )
                      }
                    },
                  },
                ],
              )
              break

            default:
              console.log("⚠️ UberDriverApp: Unhandled driver status update:", update.status)
              break
          }
        }
      })

      // Role-based specific status events
      socket.on(roleConfig.events.driverArrived, (payload: any) => {
        console.log(`🔔 UberDriverApp: Received '${roleConfig.events.driverArrived}' event:`, payload)
        if (currentRideRequest && payload.bookingId === currentRideRequest.id) {
          setDriverStatus(DriverStatus.ARRIVED_AT_PICKUP)
          Alert.alert("Arrival Confirmed", "You have arrived at the pickup location.")
        }
      })

      socket.on(roleConfig.events.tripStarted, (payload: any) => {
        console.log(`🔔 UberDriverApp: Received '${roleConfig.events.tripStarted}' event:`, payload)
        if (currentRideRequest && payload.bookingId === currentRideRequest.id) {
          setDriverStatus(DriverStatus.ON_RIDE)
          // Get route to destination
          if (currentRideRequest) {
            getDirectionsRoute(currentRideRequest.pickupLocation, currentRideRequest.destinationLocation)
              .then(setRouteCoordinates)
              .catch(console.error)
          }
          Alert.alert("Trip Started", "Trip has started successfully.")
        }
      })

      socket.on(roleConfig.events.tripCompleted, (payload: any) => {
        console.log(`🔔 UberDriverApp: Received '${roleConfig.events.tripCompleted}' event:`, payload)
        if (currentRideRequest && payload.bookingId === currentRideRequest.id) {
          const earnings = payload.earnings
          Alert.alert(
            "Trip Completed!",
            `Trip completed successfully!\nTotal Earnings: GH₵${earnings?.totalEarnings || 0}\nTotal Rides: ${earnings?.totalRides || 0}`,
            [
              {
                text: "Continue",
                onPress: () => {
                  setCurrentRideRequest(null)
                  setCurrentBookingId(null)
                  setRouteCoordinates([])
                  setDriverStatus(DriverStatus.ONLINE)
                  if (earnings) {
                    setEarnings(earnings.totalEarnings)
                    setRidesCompleted(earnings.totalRides)
                    dispatch(
                      updateDriverEarnings({
                        totalEarnings: earnings.totalEarnings,
                        monthlyEarnings: earnings.totalEarnings,
                      }),
                    )
                  }
                },
              },
            ],
          )
        }
      })

      // Enhanced notification listener
      socket.on("notification", (notification: any) => {
        console.log("🔔 UberDriverApp: Received 'notification' event:", JSON.stringify(notification, null, 2))

        if (currentRideRequest && notification.data?.bookingId === currentRideRequest.id) {
          switch (notification.type) {
            case "BOOKING_CANCELLED":
              Alert.alert("Ride Cancelled", "The customer has cancelled the ride.")
              setShowRideRequest(false)
              setCurrentRideRequest(null)
              setCurrentBookingId(null)
              setRouteCoordinates([])
              setDriverStatus(DriverStatus.ONLINE)
              break

            default:
              console.log("⚠️ UberDriverApp: Unhandled notification type:", notification.type)
              break
          }
        }
      })

      socket.on("connection_confirmed", (data: any) => {
        console.log("🔔 UberDriverApp: Connection confirmed:", data)
      })

      socketRef.current = socket

      return () => {
        console.log("🔌 UberDriverApp: Cleaning up WebSocket connection.")
        socketRef.current?.disconnect()
        socketRef.current = null
      }
    }
  }, [token, user?.id, isOnline, driverStatus, currentRideRequest, driverLocation, user?.role])

  const startPulseAnimation = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ).start()
  }

  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== "granted") {
        setError("Location permission denied")
        setLoading(false)
        return
      }

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      })

      const { latitude, longitude } = currentLocation.coords
      const newDriverLocation = {
        latitude,
        longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }

      setDriverLocation(newDriverLocation)
      dispatch(updateDriverLocation({ latitude, longitude }))
      setLoading(false)

      console.log(`📍 Initial location set: ${latitude}, ${longitude}`)
    } catch (error) {
      console.log("Location error:", error)
      setError("Unable to get location. Please check your GPS settings.")
      setLoading(false)
    }
  }

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lon2 - lon1) * Math.PI) / 180

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  // Enhanced location updates with better error handling and logging
  const startLocationUpdates = async () => {
    try {
      console.log("🎯 Starting location updates...")

      // Stop any existing watcher first
      if (locationWatcher) {
        locationWatcher.remove()
      }
      if (locationUpdateIntervalRef.current) {
        clearInterval(locationUpdateIntervalRef.current)
      }

      // Start watching position changes
      const subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 2000, // Check every 2 seconds
          distanceInterval: 5, // Minimum 5 meters movement
        },
        async (newLocation) => {
          const { latitude, longitude } = newLocation.coords

          let shouldUpdateLocation = false
          let distanceMoved = 0

          if (!lastSentLocation) {
            shouldUpdateLocation = true
            console.log("📍 First location update")
          } else {
            distanceMoved = calculateDistance(
              lastSentLocation.latitude,
              lastSentLocation.longitude,
              latitude,
              longitude,
            )

            if (distanceMoved >= LOCATION_UPDATE_THRESHOLD) {
              shouldUpdateLocation = true
            }
          }

          if (shouldUpdateLocation) {
            try {
              console.log(
                `📍 Driver moved ${distanceMoved.toFixed(1)}m - updating location: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
              )

              // Update local state first
              const newDriverLocation = {
                latitude,
                longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }
              setDriverLocation(newDriverLocation)
              dispatch(updateDriverLocation({ latitude, longitude }))

              // Send location update via WebSocket
              if (socketRef.current && socketRef.current.connected && isOnline) {
                const locationPayload = {
                  latitude,
                  longitude,
                  timestamp: new Date().toISOString(),
                  heading: newLocation.coords.heading || 0,
                  speed: newLocation.coords.speed || 0,
                  accuracy: newLocation.coords.accuracy || 0,
                  // Include booking ID if driver is on a trip
                  ...(currentBookingId && { bookingId: currentBookingId }),
                }

                socketRef.current.emit("location:update", locationPayload)
                console.log(`📡 Emitted location:update:`, locationPayload)
              } else {
                console.warn(`⚠️ Cannot send location - Socket connected: ${socketRef.current?.connected}, Online: ${isOnline}`)
              }

              setLastSentLocation({ latitude, longitude })
            } catch (error) {
              console.error("❌ Location update error:", error)
            }
          }
        },
      )

      setLocationWatcher(subscription)

      // Also set up a periodic location broadcast for availability
      if (isOnline) {
        locationUpdateIntervalRef.current = setInterval(() => {
          if (socketRef.current && socketRef.current.connected && driverLocation && isOnline) {
            const availabilityPayload = {
              isOnline: true,
              isAvailable: driverStatus === DriverStatus.ONLINE,
              currentLatitude: driverLocation.latitude,
              currentLongitude: driverLocation.longitude,
              driverStatus: driverStatus,
              timestamp: new Date().toISOString(),
            }

            socketRef.current.emit("provider:status", availabilityPayload)
            console.log(`📡 Periodic provider:status emitted:`, availabilityPayload)
          }
        }, 10000) // Every 10 seconds
      }

      console.log("✅ Location updates started successfully")
    } catch (error) {
      console.error("❌ Failed to start location watching:", error)
      Alert.alert("Location Error", "Failed to start location tracking. Please check your GPS settings.")
    }
  }

  const stopLocationUpdates = () => {
    console.log("🛑 Stopping location updates...")

    if (locationWatcher) {
      locationWatcher.remove()
      setLocationWatcher(null)
    }

    if (locationUpdateIntervalRef.current) {
      clearInterval(locationUpdateIntervalRef.current)
      locationUpdateIntervalRef.current = null
    }

    setLastSentLocation(null)
    console.log("✅ Location updates stopped")
  }

  const getDirectionsRoute = async (origin: RouteCoordinate, destination: RouteCoordinate) => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${destination.latitude},${destination.longitude}&key=${GOOGLE_MAPS_API_KEY}&mode=driving`,
      )
      const data = await response.json()

      if (data.routes && data.routes.length > 0) {
        const points = data.routes[0].overview_polyline.points
        const decodedPoints = decodePolyline(points)
        return decodedPoints
      }
      return []
    } catch (error) {
      console.log("Route error:", error)
      return []
    }
  }

  // Simple polyline decoder
  const decodePolyline = (encoded: string): RouteCoordinate[] => {
    const coordinates: RouteCoordinate[] = []
    let index = 0
    let lat = 0
    let lng = 0

    while (index < encoded.length) {
      let b
      let shift = 0
      let result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const deltaLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
      lat += deltaLat

      shift = 0
      result = 0

      do {
        b = encoded.charCodeAt(index++) - 63
        result |= (b & 0x1f) << shift
        shift += 5
      } while (b >= 0x20)

      const deltaLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1
      lng += deltaLng

      coordinates.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      })
    }
    return coordinates
  }

  // Enhanced toggle online status with better WebSocket communication
  const toggleOnlineStatus = async () => {
    if (!driverLocation || !token) {
      Alert.alert("Error", "Location not available or not authenticated")
      return
    }

    try {
      const newOnlineStatus = !isOnline
      console.log(`🔄 Toggling online status from ${isOnline} to ${newOnlineStatus}`)

      // Emit status update via WebSocket
      if (socketRef.current && socketRef.current.connected) {
        const statusPayload = {
          isOnline: newOnlineStatus,
          isAvailable: newOnlineStatus,
          currentLatitude: driverLocation.latitude,
          currentLongitude: driverLocation.longitude,
          driverStatus: newOnlineStatus ? DriverStatus.ONLINE : DriverStatus.OFFLINE,
          timestamp: new Date().toISOString(),
        }

        socketRef.current.emit("provider:status", statusPayload)
        console.log(`📡 Emitted provider:status:`, statusPayload)
      } else {
        Alert.alert("Connection Error", "Not connected to the server. Please try again.")
        return
      }

      // Update local state
      setIsOnline(newOnlineStatus)
      dispatch(setDriverOnlineStatus(newOnlineStatus))
      dispatch(setDriverAvailability(newOnlineStatus))

      if (newOnlineStatus) {
        setDriverStatus(DriverStatus.ONLINE)
        console.log("🟢 Driver is now ONLINE and available for rides")
      } else {
        setDriverStatus(DriverStatus.OFFLINE)
        setCurrentRideRequest(null)
        setCurrentBookingId(null)
        setShowRideRequest(false)
        setRouteCoordinates([])
        console.log("🔴 Driver is now OFFLINE")
      }
    } catch (error) {
      console.error("❌ Toggle online status error:", error)
      Alert.alert("Error", "Failed to update online status")
    }
  }

  // Role-based API calls using direct HTTP requests
  const acceptRide = async () => {
    if (!currentRideRequest || !driverLocation) return

    setIsLoadingRequest(true)
    try {
      console.log(`🎯 Accepting ride: ${currentRideRequest.id}`)

      // Direct API call to role-based endpoint
      const response = await fetch(`${BACKEND_API_URL}${roleConfig.apiBase}/bookings/${currentRideRequest.id}/accept`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      const data = await response.json()

      if (response.ok && data.success) {
        console.log("✅ Ride accepted successfully")
        setShowRideRequest(false)
        setDriverStatus(DriverStatus.HEADING_TO_PICKUP)
        setCurrentBookingId(currentRideRequest.id)

        // Get route to pickup location
        const route = await getDirectionsRoute(
          { latitude: driverLocation.latitude, longitude: driverLocation.longitude },
          currentRideRequest.pickupLocation,
        )
        setRouteCoordinates(route)

        Alert.alert("Ride Accepted", `Heading to pickup location for ${currentRideRequest.passengerName}`)
      } else {
        console.error("❌ Failed to accept ride:", data.message)
        Alert.alert("Error", data.message || "Failed to accept ride")
      }
    } catch (error) {
      console.error("❌ Accept ride error:", error)
      Alert.alert("Error", "Failed to accept ride")
    } finally {
      setIsLoadingRequest(false)
    }
  }

  const declineRide = async () => {
    if (!currentRideRequest) return

    setIsLoadingRequest(true)
    try {
      console.log(`❌ Declining ride: ${currentRideRequest.id}`)

      // Direct API call to role-based endpoint
      const response = await fetch(`${BACKEND_API_URL}${roleConfig.apiBase}/bookings/${currentRideRequest.id}/reject`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: "Driver declined" }),
      })

      const data = await response.json()

      if (response.ok && data.success) {
        console.log("✅ Ride declined successfully")
        setShowRideRequest(false)
        setCurrentRideRequest(null)
      } else {
        console.error("❌ Failed to decline ride:", data.message)
        Alert.alert("Error", data.message || "Failed to decline ride")
      }
    } catch (error) {
      console.error("❌ Decline ride error:", error)
      Alert.alert("Error", "Failed to decline ride")
    } finally {
      setIsLoadingRequest(false)
    }
  }

  const arriveAtPickup = async () => {
    if (!currentRideRequest) return

    try {
      console.log(`📍 Marking arrival at pickup for: ${currentRideRequest.id}`)

      // Direct API call to role-based endpoint
      const response = await fetch(`${BACKEND_API_URL}${roleConfig.apiBase}/bookings/${currentRideRequest.id}/arrive`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        console.log("✅ Arrival marked successfully")
        // Status will be updated via WebSocket
      } else {
        const data = await response.json()
        throw new Error(data.message || "Failed to mark arrival")
      }
    } catch (error) {
      console.error("❌ Arrive at pickup error:", error)
      Alert.alert("Error", "Failed to mark arrival")
    }
  }

  const startRide = async () => {
    if (!currentRideRequest) return

    try {
      console.log(`🚗 Starting trip for: ${currentRideRequest.id}`)

      // Direct API call to role-based endpoint
      const response = await fetch(`${BACKEND_API_URL}${roleConfig.apiBase}/bookings/${currentRideRequest.id}/start`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        console.log("✅ Trip started successfully")
        // Status will be updated via WebSocket
      } else {
        const data = await response.json()
        throw new Error(data.message || "Failed to start ride")
      }
    } catch (error) {
      console.error("❌ Start ride error:", error)
      Alert.alert("Error", "Failed to start ride")
    }
  }

  const completeRide = async () => {
    if (!currentRideRequest || !driverLocation) return

    try {
      console.log(`🏁 Completing trip for: ${currentRideRequest.id}`)

      // Direct API call to role-based endpoint
      const completionData = {
        actualDistance: 5000, // Example value, ideally from actual tracking
        actualDuration: 15, // Example value
        finalPrice: currentRideRequest.fare,
        endLatitude: currentRideRequest.destinationLocation.latitude,
        endLongitude: currentRideRequest.destinationLocation.longitude,
      }

      const response = await fetch(`${BACKEND_API_URL}${roleConfig.apiBase}/bookings/${currentRideRequest.id}/complete`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(completionData),
      })

      if (response.ok) {
        console.log("✅ Trip completed successfully")
        // Status and earnings will be updated via WebSocket
      } else {
        const data = await response.json()
        throw new Error(data.message || "Failed to complete ride")
      }
    } catch (error) {
      console.error("❌ Complete ride error:", error)
      Alert.alert("Error", "Failed to complete ride")
    }
  }

  if (loading) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-gray-100`}>
        <Text style={tw`text-lg text-gray-600`}>Getting your location...</Text>
      </View>
    )
  }

  if (error) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-gray-100 px-5`}>
        <Text style={tw`text-base text-red-600 text-center`}>{error}</Text>
        <TouchableOpacity style={tw`mt-4 px-6 py-3 bg-blue-600 rounded-lg`} onPress={getCurrentLocation}>
          <Text style={tw`text-white font-semibold`}>Retry</Text>
        </TouchableOpacity>
      </View>
    )
  }

  if (!driverLocation) {
    return (
      <View style={tw`flex-1 justify-center items-center bg-gray-100`}>
        <Text style={tw`text-base text-red-600`}>Unable to load location</Text>
      </View>
    )
  }

  return (
    <View style={tw`flex-1 bg-black`}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={tw`flex-1`}
        region={driverLocation}
        showsUserLocation={false}
        showsMyLocationButton={false}
        followsUserLocation={false}
        showsCompass={false}
        scrollEnabled={true}
        zoomEnabled={true}
        pitchEnabled={true}
        rotateEnabled={true}
      >
        {/* Enhanced Driver Location Marker */}
        <Marker
          coordinate={{
            latitude: driverLocation.latitude,
            longitude: driverLocation.longitude,
          }}
          title="You (Driver)"
          description={`Status: ${driverStatus.replace(/_/g, " ").toUpperCase()}`}
        >
          <Animated.View
            style={[tw`items-center justify-center`, { transform: [{ scale: isOnline ? pulseAnim : 1 }] }]}
          >
            <View
              style={[
                tw`w-6 h-6 rounded-full border-3 border-white shadow-lg`,
                {
                  backgroundColor: isOnline
                    ? (driverStatus === DriverStatus.ONLINE ? "#00D856" : "#007AFF")
                    : "#666"
                },
              ]}
            />
          </Animated.View>
        </Marker>

        {/* Pickup Location Marker */}
        {currentRideRequest &&
          (driverStatus === DriverStatus.HEADING_TO_PICKUP || driverStatus === DriverStatus.ARRIVED_AT_PICKUP) && (
            <Marker
              coordinate={currentRideRequest.pickupLocation}
              title="Pickup Location"
              description={currentRideRequest.pickupLocation.address}
              pinColor="blue"
            />
          )}

        {/* Destination Marker */}
        {currentRideRequest && driverStatus === DriverStatus.ON_RIDE && (
          <Marker
            coordinate={currentRideRequest.destinationLocation}
            title="Destination"
            description={currentRideRequest.destinationLocation.address}
            pinColor="red"
          />
        )}

        {/* Route Polyline */}
        {routeCoordinates.length > 0 && (
          <Polyline
            coordinates={routeCoordinates}
            strokeColor="#007AFF"
            strokeWidth={4}
            lineDashPattern={[1]}
          />
        )}
      </MapView>

      {/* Enhanced Status Panel */}
      <View style={tw`absolute top-12 left-5 right-5 bg-white rounded-3xl p-4 shadow-lg`}>
        <View style={tw`flex-row justify-between items-center mb-4`}>
          <View style={tw`flex-1`}>
            <Text style={tw`text-xs text-gray-600 mb-1`}>Status</Text>
            <Text style={[tw`text-base font-bold`, { color: isOnline ? "#00D856" : "#666" }]}>
              {driverStatus.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          <TouchableOpacity
            style={[tw`px-6 py-3 rounded-2xl ml-4`, { backgroundColor: isOnline ? "#00D856" : "#666" }]}
            onPress={toggleOnlineStatus}
            disabled={driverStatus !== DriverStatus.OFFLINE && driverStatus !== DriverStatus.ONLINE}
          >
            <Text style={tw`text-white text-sm font-bold`}>{isOnline ? "GO OFFLINE" : "GO ONLINE"}</Text>
          </TouchableOpacity>
        </View>

        <View style={tw`flex-row justify-around mb-4`}>
          <View style={tw`items-center`}>
            <Text style={tw`text-xl font-bold text-black mb-1`}>GH₵{earnings.toFixed(2)}</Text>
            <Text style={tw`text-xs text-gray-600`}>Today's Earnings</Text>
          </View>
          <View style={tw`items-center`}>
            <Text style={tw`text-xl font-bold text-black mb-1`}>{ridesCompleted}</Text>
            <Text style={tw`text-xs text-gray-600`}>Rides Completed</Text>
          </View>
        </View>

        {/* Enhanced WebSocket Connection Status */}
        <View style={tw`flex-row items-center justify-center`}>
          <View style={[tw`w-2 h-2 rounded-full mr-2`, { backgroundColor: isConnected ? "#00D856" : "#FF0000" }]} />
          <Text style={tw`text-xs text-gray-600`}>
            WebSocket: {isConnected ? "CONNECTED" : "DISCONNECTED"}
          </Text>
          {isOnline && (
            <>
              <Text style={tw`text-xs text-gray-600 mx-2`}>•</Text>
              <Text style={tw`text-xs text-gray-600`}>
                Location: {lastSentLocation ? "TRACKING" : "WAITING"}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Action Buttons based on Driver Status */}
      {driverStatus === DriverStatus.HEADING_TO_PICKUP && (
        <View style={tw`absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200`}>
          <TouchableOpacity style={tw`bg-blue-600 py-4 rounded-2xl items-center`} onPress={arriveAtPickup}>
            <Text style={tw`text-white text-lg font-bold`}>Arrived at Pickup</Text>
          </TouchableOpacity>
        </View>
      )}

      {driverStatus === DriverStatus.ARRIVED_AT_PICKUP && (
        <View style={tw`absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200`}>
          <TouchableOpacity style={tw`bg-green-600 py-4 rounded-2xl items-center`} onPress={startRide}>
            <Text style={tw`text-white text-lg font-bold`}>Start Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {driverStatus === DriverStatus.ON_RIDE && (
        <View style={tw`absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-200`}>
          <TouchableOpacity style={tw`bg-green-600 py-4 rounded-2xl items-center`} onPress={completeRide}>
            <Text style={tw`text-white text-lg font-bold`}>Complete Ride</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Enhanced Ride Request Modal */}
      <Modal visible={showRideRequest} transparent={true} animationType="slide">
        <View style={tw`flex-1 bg-black bg-opacity-50 justify-end`}>
          <View style={tw`bg-white rounded-t-5 p-6 min-h-100`}>
            <Text style={tw`text-2xl font-bold text-center mb-5 text-black`}>New Ride Request</Text>

            {currentRideRequest && (
              <>
                <View style={tw`flex-row justify-between items-center mb-5 pb-4 border-b border-gray-200`}>
                  <Text style={tw`text-xl font-semibold text-black`}>{currentRideRequest.passengerName}</Text>
                  <Text style={tw`text-base text-gray-600`}>⭐ {currentRideRequest.passengerRating}</Text>
                </View>

                <View style={tw`mb-6`}>
                  <View style={tw`flex-row justify-between items-center py-2`}>
                    <Text style={tw`text-base text-gray-600 flex-1`}>Pickup:</Text>
                    <Text style={tw`text-base text-black flex-2 text-right`}>
                      {currentRideRequest.pickupLocation.address}
                    </Text>
                  </View>
                  <View style={tw`flex-row justify-between items-center py-2`}>
                    <Text style={tw`text-base text-gray-600 flex-1`}>Destination:</Text>
                    <Text style={tw`text-base text-black flex-2 text-right`}>
                      {currentRideRequest.destinationLocation.address}
                    </Text>
                  </View>
                  <View style={tw`flex-row justify-between items-center py-2`}>
                    <Text style={tw`text-base text-gray-600 flex-1`}>Distance:</Text>
                    <Text style={tw`text-base text-black flex-2 text-right`}>{currentRideRequest.distance}</Text>
                  </View>
                  <View style={tw`flex-row justify-between items-center py-2`}>
                    <Text style={tw`text-base text-gray-600 flex-1`}>Estimated Time:</Text>
                    <Text style={tw`text-base text-black flex-2 text-right`}>{currentRideRequest.estimatedTime}</Text>
                  </View>
                  <View style={tw`flex-row justify-between items-center py-2`}>
                    <Text style={tw`text-base text-gray-600 flex-1`}>Fare:</Text>
                    <Text style={tw`text-lg font-bold text-green-600 flex-2 text-right`}>
                      GH₵{currentRideRequest.fare.toFixed(2)}
                    </Text>
                  </View>
                </View>

                <View style={tw`flex-row gap-3`}>
                  <TouchableOpacity
                    style={tw`flex-1 py-4 bg-gray-100 rounded-2xl items-center`}
                    onPress={declineRide}
                    disabled={isLoadingRequest}
                  >
                    <Text style={tw`text-base font-semibold text-gray-600`}>
                      {isLoadingRequest ? "Declining..." : "Decline"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={tw`flex-1 py-4 bg-blue-600 rounded-2xl items-center`}
                    onPress={acceptRide}
                    disabled={isLoadingRequest}
                  >
                    <Text style={tw`text-base font-semibold text-white`}>
                      {isLoadingRequest ? "Accepting..." : "Accept"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  )
}

export default UberDriverApp