// =========================================
// SERTAXI – Rides Management
// =========================================

const Rides = {
    // Get all rides
    getAll() {
        return JSON.parse(localStorage.getItem(STORAGE.RIDES) || '[]');
    },

    // Save all rides
    saveAll(rides) {
        localStorage.setItem(STORAGE.RIDES, JSON.stringify(rides));
    },

    // Create a new ride
    create(passengerId, passengerName, origin, destination) {
        const rides = this.getAll();
        const price = Utils.calculatePrice(origin, destination);

        const ride = {
            id: Utils.generateId(),
            passengerId,
            passengerName,
            driverId: null,
            driverName: null,
            driverCar: null,
            driverPlate: null,
            origin,
            destination,
            price: Math.round(price * 100) / 100,
            status: 'waiting',
            createdAt: new Date().toISOString(),
            acceptedAt: null,
            startedAt: null,
            completedAt: null
        };

        rides.unshift(ride); // Add to beginning
        this.saveAll(rides);

        return ride;
    },

    // Get rides by passenger
    getByPassenger(passengerId) {
        return this.getAll().filter(r => r.passengerId === passengerId);
    },

    // Get rides by driver
    getByDriver(driverId) {
        return this.getAll().filter(r => r.driverId === driverId);
    },

    // Get available rides (waiting for a driver)
    getAvailable() {
        return this.getAll().filter(r => r.status === 'waiting');
    },

    // Accept a ride (driver)
    accept(rideId, driverId, driverName, driverCar, driverPlate) {
        const rides = this.getAll();
        const ride = rides.find(r => r.id === rideId);

        if (!ride) return { success: false, error: 'Corrida não encontrada.' };
        if (ride.status !== 'waiting') return { success: false, error: 'Corrida já foi aceita.' };

        ride.driverId = driverId;
        ride.driverName = driverName;
        ride.driverCar = driverCar;
        ride.driverPlate = driverPlate;
        ride.status = 'accepted';
        ride.acceptedAt = new Date().toISOString();

        this.saveAll(rides);
        return { success: true, ride };
    },

    // Start a ride
    start(rideId) {
        const rides = this.getAll();
        const ride = rides.find(r => r.id === rideId);

        if (!ride) return { success: false, error: 'Corrida não encontrada.' };
        if (ride.status !== 'accepted') return { success: false, error: 'Corrida precisa ser aceita primeiro.' };

        ride.status = 'in_progress';
        ride.startedAt = new Date().toISOString();

        this.saveAll(rides);
        return { success: true, ride };
    },

    // Complete a ride
    complete(rideId) {
        const rides = this.getAll();
        const ride = rides.find(r => r.id === rideId);

        if (!ride) return { success: false, error: 'Corrida não encontrada.' };

        ride.status = 'completed';
        ride.completedAt = new Date().toISOString();

        this.saveAll(rides);

        // Update driver stats
        if (ride.driverId) {
            Auth.updateStats(ride.driverId, {
                addRide: true,
                addEarnings: ride.price
            });
        }

        // Update passenger stats
        Auth.updateStats(ride.passengerId, { addRide: true });

        return { success: true, ride };
    },

    // Cancel a ride
    cancel(rideId) {
        const rides = this.getAll();
        const ride = rides.find(r => r.id === rideId);

        if (!ride) return { success: false, error: 'Corrida não encontrada.' };

        ride.status = 'cancelled';
        ride.completedAt = new Date().toISOString();

        this.saveAll(rides);
        return { success: true, ride };
    },

    // Get ride by ID
    getById(rideId) {
        return this.getAll().find(r => r.id === rideId) || null;
    },

    // Get driver earnings summary
    getEarnings(driverId) {
        const rides = this.getByDriver(driverId).filter(r => r.status === 'completed');
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

        const todayRides = rides.filter(r => new Date(r.completedAt) >= today);
        const weekRides = rides.filter(r => new Date(r.completedAt) >= weekAgo);
        const monthRides = rides.filter(r => new Date(r.completedAt) >= monthAgo);

        const sum = (arr) => arr.reduce((s, r) => s + r.price, 0);

        return {
            today: { count: todayRides.length, total: sum(todayRides) },
            week: { count: weekRides.length, total: sum(weekRides) },
            month: { count: monthRides.length, total: sum(monthRides) },
            allTime: { count: rides.length, total: sum(rides) }
        };
    },

    // Count rides by status
    countByStatus(rides) {
        const counts = { waiting: 0, accepted: 0, in_progress: 0, completed: 0, cancelled: 0 };
        rides.forEach(r => {
            if (counts[r.status] !== undefined) counts[r.status]++;
        });
        return counts;
    }
};
