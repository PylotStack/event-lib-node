import "jest";
import { stack } from "../../src/testUtils";
import { personMovieRentals, currentlyRentedMoviesView } from "./3_movieRental";

describe("Movie Rental Store Tests", () => {
    it("movie rental and return tests",
        stack(personMovieRentals.definition)
            // Rent a movie and ensure the event is stored
            .onAction("RENT_MOVIE", { movieName: "Forest Gump" }).commit()

            // Try renting the same movie again and ensure the event is not stored because it is already rented
            .onAction("RENT_MOVIE", { movieName: "Forest Gump" }).reject("MOVIE_ALREADY_RENTED")

            // Check our view state to ensure the movie shows up as expected
            .assertView(currentlyRentedMoviesView.definition, { movies: ["Forest Gump"] })

            // Return the movie and ensure the event is stored
            .onAction("RETURN_MOVIE", { movieName: "Forest Gump" }).commit()

            // Try returning the same movie again and ensure the event is not stored because it is not rented
            .onAction("RETURN_MOVIE", { movieName: "Forest Gump" }).reject("MOVIE_NOT_RENTED")

            // Check our view state to ensure the movie is no longer visible
            .assertView(currentlyRentedMoviesView.definition, { movies: [] })
    );
});