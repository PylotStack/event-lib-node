import { personMovieRentals, currentlyRentedMoviesView, personMovieRentalsModel } from "./1_movieRental";
import { compileView, executeAction } from "../../src/lib";
import { local } from "../../src";

async function main() {

    console.log(personMovieRentals);




    // Create a locally stored (RAM) event stack
    // const movie_rental_account_stack = local.localStack("teststack");

    // const personModel = await personMovieRentalsModel.fromStack(movie_rental_account_stack, {});

    // console.log(personModel);
    // await personModel.rentMovie("The Matrix");
    // await personModel.rentMovie("The Matrix 2");
    // await personModel.rentMovie("The Matrix 3");
    // await personModel.returnMovie("The Matrix 2");
    // console.log(personModel.currentlyRentedMovies);
}

main();
